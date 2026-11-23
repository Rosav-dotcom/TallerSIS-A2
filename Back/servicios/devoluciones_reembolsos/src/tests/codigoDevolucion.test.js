// TDSI-76/1113: codigo DEV-NNNNNN de cada devolucion -- formato, consecutivo y no editable
// (PA TDSI-1036, TDSI-1037 y TDSI-1038), y la busqueda por codigo (TDSI-1112).
// Usa la BD real (sql/script_devoluciones.sql aplicado). Borra las devoluciones que crea y,
// si nadie mas registro una mientras tanto, deja el correlativo como estaba.
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { pool, query } = require("../config/db");
const devolucionesRepo = require("../data/devolucionesRepo");
const { formatearCodigo, normalizarCodigo, FORMATO } = require("../utils/codigoDevolucion");
const { errorHandler } = require("../middlewares/errorHandler");

const FACTURA = `T1113-${String(Date.now()).slice(-8)}`; // marca las filas de esta prueba
const numero = (codigo) => Number(codigo.slice(4));

let servidor;
let base;
let correlativoInicial;

const registrar = (extra = {}, items = [{ descripcion: "Aceite 900ml", cantidad: 2, precio_unitario: 15, subtotal: 30 }]) =>
  devolucionesRepo.crear(
    {
      factura_numero: FACTURA, cliente_nit: "1234567", fecha_venta: new Date(), dentro_de_plazo: true,
      tipo: "PARCIAL", metodo_pago_original: "Efectivo", monto_total: 30, creado_por: "prueba-1113", ...extra,
    },
    items
  );

const pedir = async (ruta, opciones) => {
  const r = await fetch(`${base}${ruta}`, opciones);
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
};

test.before(async () => {
  const { rows } = await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'");
  assert.ok(rows[0], "Falta devoluciones.correlativos: corra sql/script_devoluciones.sql");
  correlativoInicial = Number(rows[0].ultimo);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  const { rows } = await query(
    "DELETE FROM devoluciones.devoluciones WHERE factura_numero = $1 RETURNING codigo", [FACTURA]
  );
  if (rows.length) {
    const ultimoMio = Math.max(...rows.map((r) => numero(r.codigo)));
    await query(
      "UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2",
      [correlativoInicial, ultimoMio]
    );
  }
  await pool.end();
});

test("TDSI-1113: formatearCodigo y normalizarCodigo", () => {
  assert.equal(formatearCodigo(1), "DEV-000001");
  assert.equal(formatearCodigo(123), "DEV-000123");
  assert.equal(formatearCodigo(1000000), "DEV-1000000");
  assert.equal(formatearCodigo(0), null);
  for (const q of ["DEV-000123", "dev-000123", "DEV-123", "dev 123", "DEV123", "123", "000123", " DEV-000123 ", 123]) {
    assert.equal(normalizarCodigo(q), "DEV-000123", String(q));
  }
  for (const q of ["", "DEV-", "DEV-0", "DEV-12a", "F-000123", "ABC", "DEV--1", null, undefined, ["DEV-1"]]) {
    assert.equal(normalizarCodigo(q), null, String(q));
  }
});

test("TDSI-1036: cada devolucion registrada recibe su codigo DEV-", async () => {
  const d = await registrar();
  assert.match(d.codigo, FORMATO);
  assert.match(d.codigo, /^DEV-\d{6}$/);
  assert.equal(d.items.length, 1);
});

test("TDSI-1037: dos devoluciones seguidas tienen codigos consecutivos", async () => {
  const primera = await registrar();
  const segunda = await registrar({ tipo: "TOTAL" });
  assert.equal(numero(segunda.codigo), numero(primera.codigo) + 1);
});

test("TDSI-229: el codigo que mande el que registra se ignora (lo pone la BD)", async () => {
  const anterior = await registrar();
  const d = await registrar({ codigo: "DEV-999999" });
  assert.equal(d.codigo, formatearCodigo(numero(anterior.codigo) + 1));
});

test("TDSI-229: una devolucion que falla no deja un hueco en la numeracion", async () => {
  const antes = await registrar();
  // cantidad 0 viola el CHECK de devolucion_items: se deshace todo, tambien el correlativo
  await assert.rejects(() => registrar({}, [{ descripcion: "X", cantidad: 0, precio_unitario: 1, subtotal: 0 }]));
  const despues = await registrar();
  assert.equal(numero(despues.codigo), numero(antes.codigo) + 1);
});

test("TDSI-229: registros al mismo tiempo salen con codigos distintos y seguidos", async () => {
  const hechas = await Promise.all(Array.from({ length: 8 }, () => registrar()));
  const numeros = hechas.map((d) => numero(d.codigo)).sort((a, b) => a - b);
  assert.equal(new Set(numeros).size, 8);
  assert.equal(numeros[7] - numeros[0], 7);
});

test("TDSI-1038: el codigo no se puede editar (el resto de la devolucion si)", async () => {
  const d = await registrar();
  await assert.rejects(
    () => query("UPDATE devoluciones.devoluciones SET codigo = 'DEV-000999' WHERE id = $1", [d.id]),
    (e) => e.code === "DV001" && /no se puede editar/.test(e.message)
  );
  const { rows } = await query(
    "UPDATE devoluciones.devoluciones SET estado = 'APROBADA', codigo = codigo WHERE id = $1 RETURNING codigo, estado",
    [d.id]
  );
  assert.deepEqual(rows[0], { codigo: d.codigo, estado: "APROBADA" });

  // por la API tampoco: no hay ruta que lo cambie
  for (const method of ["PUT", "PATCH"]) {
    const r = await pedir(`/${d.codigo}`, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo: "DEV-000999" }),
    });
    assert.equal(r.status, 404, method);
  }
  assert.equal((await pedir(`/${d.codigo}`)).cuerpo.data.codigo, d.codigo);
});

test("TDSI-1111: el codigo es UNIQUE y tiene CHECK de formato en la BD", async () => {
  const { rows } = await query(
    `SELECT c.contype, pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
      WHERE c.conrelid = 'devoluciones.devoluciones'::regclass AND c.contype IN ('u', 'c')`
  );
  assert.ok(rows.some((r) => r.contype === "u" && r.def === "UNIQUE (codigo)"));
  assert.ok(rows.some((r) => r.contype === "c" && r.def.includes("DEV-[0-9]{6,}")));
});

test("TDSI-1111: un intento de editar el codigo responde 409 con un mensaje claro", () => {
  let respuesta;
  const res = { status(s) { respuesta = { s }; return this; }, json(b) { respuesta.b = b; } };
  errorHandler(Object.assign(new Error("x"), { code: "DV001" }), {}, res);
  assert.deepEqual(respuesta, { s: 409, b: { ok: false, mensaje: "El código de la devolución no se puede editar.", detalle: null } });
});

test("TDSI-1112: busca una devolucion por su codigo DEV- (como sea que se escriba)", async () => {
  const d = await registrar({ monto_total: 46.5 }, [
    { descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12, subtotal: 12 },
    { descripcion: "Leche 1L", cantidad: 3, precio_unitario: 11.5, subtotal: 34.5 },
  ]);
  const n = String(numero(d.codigo));
  for (const q of [d.codigo, d.codigo.toLowerCase(), `DEV ${n}`, `DEV${n}`, n]) {
    const { status, cuerpo } = await pedir(`?codigo=${encodeURIComponent(q)}`);
    assert.equal(status, 200, q);
    assert.deepEqual(cuerpo.data.map((x) => x.codigo), [d.codigo], q);
  }
  const fila = (await pedir(`?codigo=${d.codigo}`)).cuerpo.data[0];
  assert.equal(fila.factura_numero, FACTURA);
  assert.equal(fila.monto_total, 46.5);
  assert.equal(fila.estado, "PENDIENTE");
});

test("TDSI-1112: detalle por codigo con sus items", async () => {
  const d = await registrar();
  const { status, cuerpo } = await pedir(`/${d.codigo.toLowerCase()}`);
  assert.equal(status, 200);
  assert.equal(cuerpo.data.codigo, d.codigo);
  assert.equal(cuerpo.data.monto_total, 30);
  assert.deepEqual(cuerpo.data.items, [{ descripcion: "Aceite 900ml", cantidad: 2, precio_unitario: 15, subtotal: 30 }]);
});

test("TDSI-1112: codigo inexistente, invalido o vacio", async () => {
  assert.deepEqual((await pedir("?codigo=DEV-9999999999")).cuerpo.data, []);
  const invalido = await pedir("?codigo=F-000123");
  assert.equal(invalido.status, 400);
  assert.equal(invalido.cuerpo.mensaje, "El código debe tener la forma DEV-000123.");
  assert.equal((await pedir("?codigo=DEV-1&codigo=DEV-2")).status, 400);

  const noExiste = await pedir("/DEV-9999999999");
  assert.equal(noExiste.status, 404);
  assert.equal(noExiste.cuerpo.mensaje, "Devolución no encontrada");
  assert.equal((await pedir("/no-es-un-codigo")).status, 404);

  // sin codigo: la lista, las mas nuevas primero
  const lista = (await pedir("")).cuerpo.data;
  assert.ok(Array.isArray(lista) && lista.length > 0);
  const mias = lista.filter((x) => x.factura_numero === FACTURA).map((x) => numero(x.codigo));
  assert.deepEqual(mias, [...mias].sort((a, b) => b - a));
});
