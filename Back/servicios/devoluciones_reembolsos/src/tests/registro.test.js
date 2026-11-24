// TDSI-70/1002: registro de devoluciones -- total, parcial y cantidad mayor a la comprada
// (PA TDSI-1006, TDSI-1007 y TDSI-1008), lo ya devuelto, validaciones y filtros de la lista.
// Facturacion se reemplaza por un servidor falso con facturas de prueba; las devoluciones van
// a la BD real y se borran al final (el correlativo DEV- vuelve a su valor si nadie mas
// registro una mientras tanto).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const SUF = String(Date.now()).slice(-8);
const N = (letra) => `T70-${SUF}-${letra}`; // N° de factura de prueba (VARCHAR 20)
const hoy = new Date().toISOString();
const haceUnMes = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

let siguienteItem = 9000;
function factura(letra, items, extra = {}) {
  const conId = items.map(([descripcion, cantidad, precio]) => ({
    id: String(siguienteItem++), descripcion, cantidad: String(cantidad), precio_unitario: String(precio),
    subtotal: (cantidad * precio).toFixed(2),
  }));
  const subtotal = conId.reduce((a, i) => a + Number(i.subtotal), 0);
  return {
    numero: N(letra), fecha: hoy, estado: "Emitida", cliente_nit: "1234567", cliente_nombre: "Juan Perez",
    canal: "Presencial", venta_id: `VTA-${letra}`, subtotal: subtotal.toFixed(2), descuento: "0", impuesto: "0",
    total: subtotal.toFixed(2), items: conId, metodosPago: [{ metodo: "Efectivo", monto: subtotal.toFixed(2) }], ...extra,
  };
}

const FACTURAS = Object.fromEntries([
  factura("A", [["Aceite 900ml", 3, 15], ["Arroz 1kg", 1, 12]]), // 57
  factura("B", [["Aceite 900ml", 3, 15]]),
  factura("C", [["Leche 1L", 3, 8]]),
  factura("D", [["Queso 1kg", 2, 50]], { subtotal: "100.00", descuento: "10.00", total: "90.00" }), // con descuento
  factura("E", [["Papa (kg)", 2.5, 6]]), // cantidades con decimales
  factura("F", [["Azucar 1kg", 1, 9]], { fecha: haceUnMes }), // fuera de plazo
  factura("G", [["Sal", 1, 3]], { estado: "Anulada" }),
  factura("H", [], { subtotal: "10", total: "10" }), // venta sin items
  factura("I", [["Fideo", 4, 5]], { metodosPago: [{ metodo: "Efectivo", monto: "8" }, { metodo: "QR", monto: "12" }] }),
  factura("J", [["Gaseosa 2L", 2, 14]]), // concurrencia
  factura("K", [["Yogurt 1L", 5, 10]]), // motivo y observaciones (TDSI-71)
].map((f) => [f.numero, f]));

const falso = express();
falso.get("/api/facturas/:numero", (req, res) => {
  const f = FACTURAS[req.params.numero];
  return f ? res.json({ ok: true, data: f }) : res.status(404).json({ ok: false });
});

let servidorFalso, servidor, base, query, pool, correlativoInicial;
const idDe = (letra, i = 0) => Number(FACTURAS[N(letra)].items[i].id);

async function registrar(cuerpo) {
  const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return { status: r.status, cuerpo: await r.json() };
}
const pedir = async (ruta) => {
  const r = await fetch(`${base}${ruta}`);
  return { status: r.status, cuerpo: await r.json() };
};

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.FACTURACION_URL = `http://localhost:${servidorFalso.address().port}`;
  ({ query, pool } = require("../config/db"));
  const { rows } = await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'");
  correlativoInicial = Number(rows[0].ultimo);
  const app = require("../app");
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  const { rows } = await query(
    "DELETE FROM devoluciones.devoluciones WHERE factura_numero LIKE $1 RETURNING codigo", [`T70-${SUF}-%`]
  );
  if (rows.length) {
    const ultimoMio = Math.max(...rows.map((r) => Number(r.codigo.slice(4))));
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2",
      [correlativoInicial, ultimoMio]);
  }
  await pool.end();
});

test("TDSI-1006: al devolver todas las unidades la devolucion queda TOTAL (con el total de la factura)", async () => {
  const { status, cuerpo } = await registrar({
    factura_numero: N("A"), items: [{ item_id: idDe("A", 0), cantidad: 3 }, { item_id: idDe("A", 1), cantidad: 1 }],
    creado_por: "encargado@test.com",
  });
  assert.equal(status, 201);
  const d = cuerpo.data;
  assert.match(d.codigo, /^DEV-\d{6}$/);
  assert.equal(cuerpo.mensaje, `Devolución ${d.codigo} registrada.`);
  assert.equal(d.tipo, "TOTAL");
  assert.equal(d.monto_total, 57);
  assert.equal(d.estado, "PENDIENTE");
  assert.equal(d.factura_numero, N("A"));
  assert.equal(d.venta_id, "VTA-A");
  assert.equal(d.cliente_nit, "1234567");
  assert.equal(d.metodo_pago_original, "Efectivo");
  assert.equal(d.dentro_de_plazo, true);
  assert.equal(d.creado_por, "encargado@test.com");
  assert.deepEqual(d.items.map((i) => [i.item_id, i.descripcion, i.cantidad, i.subtotal, i.condicion]), [
    [idDe("A", 0), "Aceite 900ml", 3, 45, "REINGRESO"],
    [idDe("A", 1), "Arroz 1kg", 1, 12, "REINGRESO"],
  ]);
  // y queda guardada: el detalle por codigo trae lo mismo
  assert.deepEqual((await pedir(`/${d.codigo}`)).cuerpo.data, d);
});

test("TDSI-1007: al devolver 1 de 3 unidades queda PARCIAL con el monto correcto", async () => {
  const { status, cuerpo } = await registrar({ factura_numero: N("B"), items: [{ item_id: idDe("B"), cantidad: 1 }] });
  assert.equal(status, 201);
  assert.equal(cuerpo.data.tipo, "PARCIAL");
  assert.equal(cuerpo.data.monto_total, 15);
  assert.equal(cuerpo.data.items[0].cantidad, 1);
  // devolver despues las otras 2 tambien es PARCIAL (la compra ya tenia una devolucion)
  const resto = await registrar({ factura_numero: N("B"), items: [{ item_id: idDe("B"), cantidad: 2, condicion: "MERMA" }] });
  assert.equal(resto.status, 201);
  assert.equal(resto.cuerpo.data.tipo, "PARCIAL");
  assert.equal(resto.cuerpo.data.monto_total, 30);
  assert.equal(resto.cuerpo.data.items[0].condicion, "MERMA");
});

test("TDSI-1008: no se puede devolver mas unidades de las compradas (contando lo ya devuelto)", async () => {
  const demasiado = await registrar({ factura_numero: N("C"), items: [{ item_id: idDe("C"), cantidad: 4 }] });
  assert.equal(demasiado.status, 422);
  assert.equal(demasiado.cuerpo.mensaje, "No se puede devolver más unidades de las compradas");
  assert.deepEqual(demasiado.cuerpo.detalle, {
    item_id: idDe("C"), descripcion: "Leche 1L", comprada: 3, ya_devuelta: 0, disponible: 3, pedida: 4,
  });

  assert.equal((await registrar({ factura_numero: N("C"), items: [{ item_id: idDe("C"), cantidad: 2 }] })).status, 201);
  const otra = await registrar({ factura_numero: N("C"), items: [{ item_id: idDe("C"), cantidad: 2 }] });
  assert.equal(otra.status, 422);
  assert.equal(otra.cuerpo.detalle.ya_devuelta, 2);
  assert.equal(otra.cuerpo.detalle.disponible, 1);
  assert.equal((await registrar({ factura_numero: N("C"), items: [{ item_id: idDe("C"), cantidad: 1 }] })).status, 201);
  assert.equal((await registrar({ factura_numero: N("C"), items: [{ item_id: idDe("C"), cantidad: 1 }] })).status, 422);
  // ninguna de las rechazadas por exceso se guardo
  const { rows } = await query("SELECT count(*)::int AS n FROM devoluciones.devoluciones WHERE factura_numero = $1", [N("C")]);
  assert.equal(rows[0].n, 2);
});

test("TDSI-1001: una devolucion RECHAZADA no cuenta como ya devuelta", async () => {
  const B = await registrar({ factura_numero: N("I"), items: [{ item_id: idDe("I"), cantidad: 4 }] });
  assert.equal(B.status, 201);
  assert.equal((await registrar({ factura_numero: N("I"), items: [{ item_id: idDe("I"), cantidad: 1 }] })).status, 422);
  await query("UPDATE devoluciones.devoluciones SET estado = 'RECHAZADA' WHERE codigo = $1", [B.cuerpo.data.codigo]);
  const otra = await registrar({ factura_numero: N("I"), items: [{ item_id: idDe("I"), cantidad: 4 }] });
  assert.equal(otra.status, 201);
  assert.equal(otra.cuerpo.data.metodo_pago_original, "Efectivo + QR");
});

test("TDSI-1001: dos registros al mismo tiempo no devuelven la misma unidad", async () => {
  const [a, b] = await Promise.all([
    registrar({ factura_numero: N("J"), items: [{ item_id: idDe("J"), cantidad: 2 }] }),
    registrar({ factura_numero: N("J"), items: [{ item_id: idDe("J"), cantidad: 2 }] }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 422]);
});

test("TDSI-1001: descuento proporcional y cantidades con decimales", async () => {
  const conDescuento = await registrar({ factura_numero: N("D"), items: [{ item_id: idDe("D"), cantidad: 1 }] });
  assert.equal(conDescuento.status, 201);
  assert.equal(conDescuento.cuerpo.data.monto_total, 45); // 50 de 100 con 10% de descuento
  const total = await registrar({ factura_numero: N("D"), items: [{ item_id: idDe("D"), cantidad: 1 }] });
  assert.equal(total.cuerpo.data.tipo, "PARCIAL");

  const kg = await registrar({ factura_numero: N("E"), items: [{ item_id: idDe("E"), cantidad: 1.25 }] });
  assert.equal(kg.status, 201);
  assert.equal(kg.cuerpo.data.monto_total, 7.5);
  assert.equal(kg.cuerpo.data.items[0].cantidad, 1.25);
  assert.equal((await registrar({ factura_numero: N("E"), items: [{ item_id: idDe("E"), cantidad: 1.26 }] })).status, 422);
});

test("TDSI-1001: fuera de plazo, anulada, inexistente o sin items no se registra", async () => {
  const fuera = await registrar({ factura_numero: N("F"), items: [{ item_id: idDe("F"), cantidad: 1 }] });
  assert.equal(fuera.status, 422);
  assert.equal(fuera.cuerpo.mensaje, "La compra está fuera del plazo de devolución.");
  assert.equal(fuera.cuerpo.detalle.dias_transcurridos > fuera.cuerpo.detalle.plazo_dias, true);

  for (const numero of [N("G"), "T70-NO-EXISTE"]) {
    const r = await registrar({ factura_numero: numero, items: [{ item_id: 1, cantidad: 1 }] });
    assert.equal(r.status, 404, numero);
    assert.equal(r.cuerpo.mensaje, "Comprobante no encontrado o anulado");
  }
  const sinItems = await registrar({ factura_numero: N("H"), items: [{ item_id: 1, cantidad: 1 }] });
  assert.equal(sinItems.status, 422);
  assert.equal(sinItems.cuerpo.mensaje, "El comprobante no tiene ítems para devolver.");
});

test("TDSI-1001: valida el pedido", async () => {
  const casos = [
    [{}, /N\.º de factura/],
    [{ factura_numero: N("A") }, /al menos un ítem/],
    [{ factura_numero: N("A"), items: [] }, /al menos un ítem/],
    [{ factura_numero: N("A"), items: [{ cantidad: 1 }] }, /item_id/],
    [{ factura_numero: N("A"), items: [{ item_id: "abc", cantidad: 1 }] }, /item_id/],
    [{ factura_numero: N("A"), items: [{ item_id: 1, cantidad: 0 }] }, /mayor a 0/],
    [{ factura_numero: N("A"), items: [{ item_id: 1, cantidad: -1 }] }, /mayor a 0/],
    [{ factura_numero: N("A"), items: [{ item_id: 1, cantidad: 1.234 }] }, /2 decimales/],
    [{ factura_numero: N("A"), items: [{ item_id: 1, cantidad: "x" }] }, /mayor a 0/],
    [{ factura_numero: N("A"), items: [{ item_id: 1, cantidad: 1, condicion: "ROTO" }] }, /REINGRESO o MERMA/],
    [{ factura_numero: N("A"), items: [{ item_id: 5, cantidad: 1 }, { item_id: 5, cantidad: 1 }] }, /repetido/],
    [{ factura_numero: N("B"), items: [{ item_id: idDe("A", 1), cantidad: 1 }] }, /no pertenece al comprobante/],
  ];
  for (const [cuerpo, mensaje] of casos) {
    const r = await registrar(cuerpo);
    assert.equal(r.status, 400, JSON.stringify(cuerpo));
    assert.match(r.cuerpo.mensaje, mensaje, JSON.stringify(cuerpo));
  }
  // sin cuerpo JSON
  const r = await fetch(base, { method: "POST" });
  assert.equal(r.status, 400);
});

test("TDSI-1001: el comprobante trae item_id para armar el pedido", async () => {
  // (lo usa la pantalla: GET /comprobantes/:numero -> items[].item_id)
  const { cuerpo } = await pedir(`/comprobantes/${N("A")}`);
  assert.deepEqual(cuerpo.data.items.map((i) => i.item_id), [idDe("A", 0), idDe("A", 1)]);
});

// ---------- TDSI-71/1103: motivo y observaciones ----------
async function motivoId(nombre) {
  const { rows } = await query("SELECT id FROM devoluciones.motivos WHERE nombre = $1", [nombre]);
  return Number(rows[0].id);
}

test("TDSI-1103: el motivo y las observaciones se guardan y vuelven en el detalle y en la lista", async () => {
  const vencido = await motivoId("Producto vencido");
  const { status, cuerpo } = await registrar({
    factura_numero: N("K"), items: [{ item_id: idDe("K"), cantidad: 1 }],
    motivo_id: vencido, observaciones: "  Fecha de vencimiento 20/11, el cliente trae el ticket.  ",
  });
  assert.equal(status, 201);
  const d = cuerpo.data;
  assert.equal(d.motivo_id, vencido);
  assert.deepEqual(d.motivo, { id: vencido, nombre: "Producto vencido" });
  assert.equal(d.observaciones, "Fecha de vencimiento 20/11, el cliente trae el ticket.");

  // guardado: el detalle por codigo trae lo mismo, y la lista muestra el motivo
  assert.deepEqual((await pedir(`/${d.codigo}`)).cuerpo.data, d);
  const fila = (await pedir(`?codigo=${d.codigo}`)).cuerpo.data[0];
  assert.equal(fila.motivo, "Producto vencido");

  // observaciones vacias quedan en null; el motivo se puede mandar como texto numerico
  const otra = await registrar({
    factura_numero: N("K"), items: [{ item_id: idDe("K"), cantidad: 1 }],
    motivo_id: String(await motivoId("Cambio de producto")), observaciones: "   ",
  });
  assert.equal(otra.status, 201);
  assert.equal(otra.cuerpo.data.motivo.nombre, "Cambio de producto");
  assert.equal(otra.cuerpo.data.observaciones, null);
});

test("TDSI-1103: un motivo que no existe o esta desactivado no se acepta", async () => {
  // un motivo desactivado propio de la prueba (en una BD nueva no hay otro inactivo)
  const { rows } = await query(
    "INSERT INTO devoluciones.motivos (nombre, activo) VALUES ($1, false) RETURNING id", [`Inactivo ${SUF}`]
  );
  const desactivado = Number(rows[0].id);
  try {
    for (const motivo_id of [desactivado, 999999, "abc", -1, 1.5]) {
      const r = await registrar({ factura_numero: N("K"), items: [{ item_id: idDe("K"), cantidad: 1 }], motivo_id });
      assert.equal(r.status, 400, String(motivo_id));
      assert.equal(r.cuerpo.mensaje, "El motivo no es válido.");
    }
  } finally {
    await query("DELETE FROM devoluciones.motivos WHERE id = $1", [desactivado]);
  }
  const noTexto = await registrar({
    factura_numero: N("K"), items: [{ item_id: idDe("K"), cantidad: 1 }],
    motivo_id: await motivoId("Producto vencido"), observaciones: 123,
  });
  assert.equal(noTexto.status, 400);
  assert.equal(noTexto.cuerpo.mensaje, "Las observaciones deben ser texto.");
});

test("TDSI-70: la lista se filtra por estado y por fecha", async () => {
  const mias = (data) => data.filter((d) => d.factura_numero.startsWith(`T70-${SUF}`));
  const hoyBo = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());

  const todas = mias((await pedir("")).cuerpo.data);
  assert.ok(todas.length >= 10);
  const rechazadas = mias((await pedir("?estado=rechazada")).cuerpo.data);
  assert.deepEqual(rechazadas.map((d) => d.estado), ["RECHAZADA"]);
  assert.equal(mias((await pedir(`?desde=${hoyBo}&hasta=${hoyBo}`)).cuerpo.data).length, todas.length);
  assert.equal(mias((await pedir("?hasta=2020-01-01")).cuerpo.data).length, 0);

  for (const malo of ["?estado=BORRADA", "?desde=2026-13-01", "?hasta=ayer", "?desde=2026-11-10&hasta=2026-11-01"]) {
    assert.equal((await pedir(malo)).status, 400, malo);
  }
});
