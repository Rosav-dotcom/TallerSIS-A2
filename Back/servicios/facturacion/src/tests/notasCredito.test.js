// TDSI-73/1017: notas de credito -- monto mayor a la factura (PA TDSI-1023), numeracion, la factura
// original (PA TDSI-1022) y el PDF (PA TDSI-1024). Usa la BD real; las facturas de prueba se
// borran al final (sus notas caen por ON DELETE CASCADE).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const facturasService = require("../services/facturasService");
const { pool, query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { normalizarNumero } = require("../services/notasCreditoService");

const NIT = `73${String(Date.now()).slice(-7)}`;
const creadas = [];
let servidor, base;

async function nuevaFactura(items = [{ descripcion: "Aceite 900ml", cantidad: 3, precio_unitario: 15 }, { descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12 }]) {
  const f = await facturasService.crearFactura({ nit: NIT, razon_social: "Cliente Notas", items, metodos: [{ metodo: "Efectivo" }] });
  creadas.push(f.id);
  return f; // total 57 por defecto
}
const emitir = async (cuerpo) => {
  const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return { status: r.status, cuerpo: await r.json() };
};
const nota = (factura, extra = {}) => ({
  factura_numero: factura.numero, motivo: "Devolución de prueba", emitida_por: "ana@test.com",
  items: [{ descripcion: "Aceite 900ml", cantidad: 1, precio_unitario: 15 }], ...extra,
});
const n = (numero) => Number(numero.slice(3));

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/notas-credito", require("../routes/notasCreditoRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/notas-credito`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await query("DELETE FROM facturacion.facturas WHERE id = ANY($1)", [creadas]);
  await query("DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1", [NIT]);
  await pool.end();
});

test("TDSI-1022: la nota queda vinculada a la factura original (y se ve en el detalle)", async () => {
  const f = await nuevaFactura();
  const { status, cuerpo } = await emitir(nota(f, { devolucion_codigo: "dev-000777" }));
  assert.equal(status, 201);
  const d = cuerpo.data;
  assert.match(d.numero, /^NC-\d{6}$/);
  assert.equal(cuerpo.mensaje, `Nota de crédito ${d.numero} emitida.`);
  assert.deepEqual([d.factura_original.numero, d.factura_original.total, d.factura_original.cliente_nit], [f.numero, 57, NIT]);
  assert.deepEqual([d.devolucion_codigo, d.monto, d.estado, d.emitida_por], ["DEV-000777", 15, "EMITIDA", "ana@test.com"]);
  assert.deepEqual(d.items, [{ descripcion: "Aceite 900ml", cantidad: 1, precio_unitario: 15, subtotal: 15 }]);
  assert.equal(d.pdf_url, `/api/notas-credito/${d.numero}/pdf`);

  const r = await fetch(`${base}/${d.numero.toLowerCase()}`);
  assert.deepEqual((await r.json()).data, d);
  const lista = await (await fetch(`${base}?factura=${f.numero}`)).json();
  assert.deepEqual(lista.data.map((x) => x.numero), [d.numero]);
});

test("TDSI-1023: no se puede emitir por mas del total de la factura (sola ni sumando notas)", async () => {
  const f = await nuevaFactura(); // total 57
  const sola = await emitir(nota(f, { items: [{ descripcion: "Todo y mas", cantidad: 1, precio_unitario: 60 }] }));
  assert.equal(sola.status, 422);
  assert.equal(sola.cuerpo.mensaje, "No se puede emitir una nota de crédito por más del total de la factura.");
  assert.deepEqual(sola.cuerpo.detalle, { total_factura: 57, ya_emitido: 0, disponible: 57, monto: 60 });

  assert.equal((await emitir(nota(f, { items: [{ descripcion: "Aceite", cantidad: 3, precio_unitario: 15 }] }))).status, 201); // 45
  const pasa = await emitir(nota(f, { items: [{ descripcion: "Arroz", cantidad: 1, precio_unitario: 12.01 }] }));
  assert.equal(pasa.status, 422);
  assert.equal(pasa.cuerpo.detalle.disponible, 12);
  const justo = await emitir(nota(f, { items: [{ descripcion: "Arroz", cantidad: 1, precio_unitario: 12 }] }));
  assert.equal(justo.status, 201); // 45 + 12 = 57 exacto
  assert.equal((await emitir(nota(f, { items: [{ descripcion: "X", cantidad: 1, precio_unitario: 0.01 }] }))).status, 422);

  // una nota ANULADA libera su monto
  await query("UPDATE facturacion.notas_credito SET estado = 'ANULADA' WHERE numero = $1", [justo.cuerpo.data.numero]);
  assert.equal((await emitir(nota(f, { items: [{ descripcion: "Arroz", cantidad: 1, precio_unitario: 12 }] }))).status, 201);
});

test("TDSI-1023: la BD tambien lo impide (trigger) y se responde 422", async () => {
  const f = await nuevaFactura();
  await assert.rejects(
    () => query(`INSERT INTO facturacion.notas_credito (numero, factura_id, motivo, monto, emitida_por) VALUES ('NC-${String(Date.now()).slice(-9)}', $1, 'x', 57.01, 'x')`, [f.id]),
    (e) => e.code === "NC001"
  );
  let respuesta;
  const res = { status(s) { respuesta = { s }; return this; }, json(b) { respuesta.b = b; } };
  errorHandler(Object.assign(new Error("x"), { code: "NC001" }), {}, res);
  assert.deepEqual(respuesta, { s: 422, b: { ok: false, mensaje: "La nota de crédito no puede superar el total de la factura.", detalle: null } });
});

test("TDSI-1017: numeracion NC-NNNNNN correlativa, tambien con emisiones al mismo tiempo", async () => {
  const f = await nuevaFactura([{ descripcion: "Caja", cantidad: 10, precio_unitario: 10 }]); // 100
  const a = (await emitir(nota(f, { items: [{ descripcion: "Caja", cantidad: 1, precio_unitario: 10 }] }))).cuerpo.data.numero;
  const b = (await emitir(nota(f, { items: [{ descripcion: "Caja", cantidad: 1, precio_unitario: 10 }] }))).cuerpo.data.numero;
  assert.equal(n(b), n(a) + 1);

  const juntas = await Promise.all(Array.from({ length: 5 }, () => emitir(nota(f, { items: [{ descripcion: "Caja", cantidad: 1, precio_unitario: 10 }] }))));
  const numeros = juntas.map((r) => n(r.cuerpo.data.numero)).sort((x, y) => x - y);
  assert.equal(new Set(numeros).size, 5);
  assert.equal(numeros[4] - numeros[0], 4);
  assert.equal(numeros[0], n(b) + 1);

  // y a la vez no se pasan del total: 3 notas de 10 con 30 disponibles + 1 que sobra
  const resto = await Promise.all(Array.from({ length: 4 }, () => emitir(nota(f, { items: [{ descripcion: "Caja", cantidad: 1, precio_unitario: 10 }] }))));
  assert.deepEqual(resto.map((r) => r.status).sort(), [201, 201, 201, 422]);

  assert.equal(normalizarNumero("nc-12"), "NC-000012");
  assert.equal(normalizarNumero("NC1000000"), "NC-1000000");
  assert.equal(normalizarNumero("F-000001"), null);
});

test("TDSI-1024: la nota se descarga en PDF (mismo formato que la factura, con codigo de barras)", async () => {
  const f = await nuevaFactura();
  const numero = (await emitir(nota(f))).cuerpo.data.numero;
  const r = await fetch(`${base}/${numero}/pdf`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.equal(r.headers.get("content-disposition"), `inline; filename="${numero}.pdf"`);
  const pdf = Buffer.from(await r.arrayBuffer());
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.match(pdf.toString("latin1"), /\/Subtype \/Image/);
  assert.equal((await fetch(`${base}/NC-999999999/pdf`)).status, 404);
});

test("TDSI-1016: validaciones (factura, items, monto y una nota por devolucion)", async () => {
  const f = await nuevaFactura();
  assert.equal((await emitir(nota({ numero: "F-999999" }))).status, 404);
  const anulada = await nuevaFactura();
  await query("UPDATE facturacion.facturas SET estado = 'Anulada' WHERE id = $1", [anulada.id]);
  const r = await emitir(nota(anulada));
  assert.equal(r.status, 409);
  assert.match(r.cuerpo.mensaje, /factura emitida/);

  for (const [extra, mensaje] of [
    [{ items: [] }, /al menos un ítem/],
    [{ motivo: "  " }, /'motivo' es obligatorio/],
    [{ emitida_por: undefined }, /'emitida_por' es obligatorio/],
    [{ items: [{ descripcion: "X", cantidad: 0, precio_unitario: 1 }] }, /cantidad/],
    [{ monto: 16 }, /mayor a la suma de los ítems/],
    [{ monto: 0 }, /mayor a 0/],
    [{ devolucion_codigo: "123" }, /DEV-000123/],
  ]) {
    const res = await emitir(nota(f, extra));
    assert.equal(res.status, 400, JSON.stringify(extra));
    assert.match(res.cuerpo.mensaje, mensaje, JSON.stringify(extra));
  }
  // con descuento el monto puede ser menor que los items
  assert.equal((await emitir(nota(f, { monto: 13.5 }))).cuerpo.data.monto, 13.5);

  const codigo = `DEV-${String(Date.now()).slice(-7)}`;
  const primera = await emitir(nota(f, { devolucion_codigo: codigo }));
  const otra = await emitir(nota(f, { devolucion_codigo: codigo }));
  assert.equal(otra.status, 409);
  assert.equal(otra.cuerpo.detalle.numero, primera.cuerpo.data.numero);
  const g = await nuevaFactura(); // con saldo: el segundo choca con "una por devolucion", no con el total
  const [x, y] = await Promise.all([1, 2].map(() => emitir(nota(g, { devolucion_codigo: `${codigo}9` }))));
  assert.deepEqual([x.status, y.status].sort(), [201, 409]);

  assert.equal((await fetch(`${base}/NC-999999999`)).status, 404);
  assert.equal((await fetch(base)).status, 400); // sin ?factura=
});
