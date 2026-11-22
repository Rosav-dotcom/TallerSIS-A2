// TDSI-68/991: busqueda de facturas para Devoluciones, metodos de pago al emitir y codigo
// de barras en el PDF. Usa la BD real y limpia lo que crea.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { query, pool } = require("../config/db");
const { crearFactura, buscarFacturas } = require("../services/facturasService");
const facturasRepo = require("../data/facturasRepo");
const { generarPdfBuffer } = require("../services/documentosService");

const SUFIJO = String(Date.now()).slice(-8);
const NIT = `7${SUFIJO}`; // 9 digitos, no choca con otros tests
const facturas = {};
let servidor;
let base;

const digitos = (numero) => String(Number(numero.split("-")[1]));

test.before(async () => {
  facturas.efectivo = await crearFactura({
    nit: NIT, razon_social: "José Pérez Ñandú",
    items: [{ descripcion: "Aceite 900ml", cantidad: 3, precio_unitario: 15 }, { descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12 }],
    metodos: [{ metodo: "Efectivo" }],
  });
  facturas.mixta = await crearFactura({
    nit: NIT, razon_social: "José Pérez Ñandú",
    items: [{ descripcion: "Leche 1L", cantidad: 2, precio_unitario: 8 }],
    metodos: [{ metodo: "Efectivo", monto: 6 }, { metodo: "QR", monto: 10 }],
    canal: "Online",
  });
  facturas.anulada = await crearFactura({
    nit: NIT, razon_social: "José Pérez Ñandú",
    items: [{ descripcion: "Azucar 1kg", cantidad: 1, precio_unitario: 9 }],
  });
  await query("UPDATE facturacion.facturas SET estado = 'Anulada' WHERE id = $1", [facturas.anulada.id]);

  const app = express();
  app.use("/api/facturas", require("../routes/facturacionRoutes"));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ ok: false, mensaje: err.message }));
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/facturas`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await query("DELETE FROM facturacion.facturas WHERE cliente_nit = $1", [NIT]);
  await query("DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1", [NIT]);
  await pool.end();
});

test("TDSI-991: al emitir se guardan los metodos de pago y el canal", async () => {
  const efectivo = await facturasRepo.obtenerFacturaCompleta(facturas.efectivo.numero);
  assert.deepEqual(efectivo.metodosPago.map((m) => [m.metodo, Number(m.monto)]), [["Efectivo", 57]]);
  assert.equal(efectivo.canal, "Presencial");

  const mixta = await facturasRepo.obtenerFacturaCompleta(facturas.mixta.numero);
  assert.deepEqual(mixta.metodosPago.map((m) => [m.metodo, Number(m.monto)]), [["Efectivo", 6], ["QR", 10]]);
  assert.equal(mixta.canal, "Online");

  // sin "metodos" se sigue emitiendo como antes (compatibilidad)
  const sinMetodos = await facturasRepo.obtenerFacturaCompleta(facturas.anulada.numero);
  assert.deepEqual(sinMetodos.metodosPago, []);
});

test("TDSI-991: valida los metodos de pago al emitir", async () => {
  const item = [{ descripcion: "X", cantidad: 1, precio_unitario: 10 }];
  await assert.rejects(() => crearFactura({ nit: NIT, razon_social: "X", items: item, metodos: [{ metodo: "Cheque" }] }), { status: 400 });
  await assert.rejects(() => crearFactura({ nit: NIT, razon_social: "X", items: item, metodos: [{ metodo: "QR", monto: 4 }, { metodo: "Efectivo", monto: 4 }] }), /suma/);
  await assert.rejects(() => crearFactura({ nit: NIT, razon_social: "X", items: item, metodos: [] }), { status: 400 });
  await assert.rejects(() => crearFactura({ nit: NIT, razon_social: "X", items: item, canal: "Telefono" }), { status: 400 });
});

test("TDSI-991: el codigo de barras del comprobante es su N° de factura", async () => {
  const f = await facturasRepo.obtenerFacturaCompleta(facturas.efectivo.numero);
  assert.equal(f.codigo_barras, facturas.efectivo.numero);
});

test("TDSI-991/994: por N° de factura (como lo escribe el lector o a mano) sale solo esa factura", async () => {
  const n = facturas.efectivo.numero;
  for (const q of [n, n.toLowerCase(), `F ${digitos(n)}`, `F${digitos(n)}`, digitos(n), digitos(n).padStart(6, "0")]) {
    const r = await buscarFacturas(q);
    assert.equal(r.criterio, "numero", q);
    assert.deepEqual(r.facturas.map((f) => f.numero), [n], q);
  }
});

test("TDSI-991/995: por NIT/CI salen todas las compras del cliente (con su estado)", async () => {
  const r = await buscarFacturas(NIT);
  assert.equal(r.criterio, "nit");
  assert.deepEqual(
    r.facturas.map((f) => f.numero).sort(),
    [facturas.efectivo.numero, facturas.mixta.numero, facturas.anulada.numero].sort()
  );
  assert.equal(r.facturas.find((f) => f.numero === facturas.anulada.numero).estado, "Anulada");
  assert.equal(typeof r.facturas[0].total, "number");
});

test("TDSI-991: por nombre del cliente, sin mayusculas ni tildes", async () => {
  const r = await buscarFacturas("jose perez nandu");
  assert.equal(r.criterio, "cliente");
  assert.ok(r.facturas.some((f) => f.numero === facturas.mixta.numero));
});

test("TDSI-991: busqueda vacia, repetida o muy larga responde 400", async () => {
  await assert.rejects(() => buscarFacturas("  "), { status: 400 });
  await assert.rejects(() => buscarFacturas(["a", "b"]), { status: 400 });
  await assert.rejects(() => buscarFacturas("x".repeat(101)), { status: 400 });
});

test("TDSI-991: GET /api/facturas/buscar?q= por HTTP (no lo confunde con /:numero)", async () => {
  const r = await fetch(`${base}/buscar?q=${encodeURIComponent(facturas.mixta.numero)}`);
  assert.equal(r.status, 200);
  const { data } = await r.json();
  assert.equal(data.criterio, "numero");
  assert.equal(data.facturas[0].numero, facturas.mixta.numero);

  const vacio = await fetch(`${base}/buscar?q=`);
  assert.equal(vacio.status, 400);
});

test("TDSI-991: el PDF de la factura lleva la imagen del codigo de barras", async () => {
  const f = await facturasRepo.obtenerFacturaCompleta(facturas.efectivo.numero);
  const pdf = await generarPdfBuffer(f);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.match(pdf.toString("latin1"), /\/Subtype \/Image/);
});
