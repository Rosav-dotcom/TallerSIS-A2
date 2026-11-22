// TDSI-68/991: busqueda del comprobante de venta original. Facturacion se reemplaza por un
// servidor falso con las mismas rutas (/api/facturas/buscar y /api/facturas/:numero), asi
// la prueba no depende de las facturas de la BD. FACTURACION_URL se fija ANTES de cargar la app.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const FACTURAS = {
  "F-000123": {
    numero: "F-000123", codigo_barras: "F-000123", fecha: "2026-11-20T14:00:00.000Z",
    cliente_nit: "1234567", cliente_nombre: "Juan Perez", canal: "Presencial", estado: "Emitida",
    subtotal: "57.00", descuento: "0.00", impuesto: "0.00", total: "57.00",
    items: [
      { descripcion: "Aceite 900ml", cantidad: "3.00", precio_unitario: "15.00", subtotal: "45.00" },
      { descripcion: "Arroz 1kg", cantidad: "1.00", precio_unitario: "12.00", subtotal: "12.00" },
    ],
    metodosPago: [{ metodo: "Efectivo", monto: "40.00" }, { metodo: "QR", monto: "17.00" }],
  },
  "F-000124": {
    numero: "F-000124", fecha: "2026-11-21T10:00:00.000Z", cliente_nit: "1234567", cliente_nombre: "Juan Perez",
    canal: "Online", estado: "Anulada", subtotal: "9.00", descuento: "0", impuesto: "0", total: "9.00",
    items: [{ descripcion: "Azucar", cantidad: "1", precio_unitario: "9", subtotal: "9" }], metodosPago: [],
  },
  "F-000125": {
    numero: "F-000125", fecha: "2026-11-21T11:00:00.000Z", cliente_nit: "1234567", cliente_nombre: "Juan Perez",
    canal: "Presencial", estado: "AnulacionSolicitada", subtotal: "20", descuento: "0", impuesto: "0", total: "20",
    items: [{ descripcion: "Leche", cantidad: "2", precio_unitario: "10", subtotal: "20" }], metodosPago: [{ metodo: "Tarjeta", monto: "20" }],
  },
};
const resumen = ({ numero, fecha, cliente_nit, cliente_nombre, canal, total, estado }) => ({ numero, fecha, cliente_nit, cliente_nombre, canal, total: Number(total), estado });

let facturacionCaida = false;
const falso = express();
falso.get("/api/facturas/buscar", (req, res) => {
  if (facturacionCaida) return res.status(500).json({ ok: false });
  const q = String(req.query.q);
  if (q.length > 100) return res.status(400).json({ ok: false, mensaje: "La busqueda admite hasta 100 caracteres." });
  const m = /^(?:F[-\s]?)?(\d{1,6})$/i.exec(q);
  if (m) {
    const numero = `F-${m[1].padStart(6, "0")}`;
    return res.json({ ok: true, data: { criterio: "numero", facturas: FACTURAS[numero] ? [resumen(FACTURAS[numero])] : [] } });
  }
  if (/^\d{7,15}$/.test(q)) {
    return res.json({ ok: true, data: { criterio: "nit", facturas: Object.values(FACTURAS).filter((f) => f.cliente_nit === q).map(resumen) } });
  }
  return res.json({ ok: true, data: { criterio: "cliente", facturas: [] } });
});
falso.get("/api/facturas/:numero", (req, res) => {
  const f = FACTURAS[req.params.numero];
  if (!f) return res.status(404).json({ ok: false, mensaje: "Factura no encontrada" });
  res.json({ ok: true, data: f });
});

let servidorFalso;
let servidor;
let base;

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.FACTURACION_URL = `http://localhost:${servidorFalso.address().port}`;
  const app = require("../app");
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones/comprobantes`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  await require("../config/db").pool.end();
});

const pedir = async (ruta) => {
  const r = await fetch(`${base}${ruta}`);
  return { status: r.status, cuerpo: await r.json() };
};

test("TDSI-994: por N° de factura sale el comprobante con items, cantidades, montos, fecha y metodo de pago", async () => {
  const { status, cuerpo } = await pedir("?q=F-000123");
  assert.equal(status, 200);
  assert.equal(cuerpo.data.criterio, "numero");
  const c = cuerpo.data.comprobante;
  assert.equal(c.numero, "F-000123");
  assert.equal(c.fecha, "2026-11-20T14:00:00.000Z");
  assert.equal(c.total, 57);
  assert.deepEqual(c.items, [
    { descripcion: "Aceite 900ml", cantidad: 3, precio_unitario: 15, subtotal: 45 },
    { descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12, subtotal: 12 },
  ]);
  assert.deepEqual(c.metodos_pago, [{ metodo: "Efectivo", monto: 40 }, { metodo: "QR", monto: 17 }]);
  assert.equal(c.metodo_pago, "Efectivo + QR");
});

test("TDSI-991: el codigo de barras del ticket (o el numero sin ceros) encuentra el mismo comprobante", async () => {
  for (const q of ["F-000123", "f-000123", "123", "F123"]) {
    const { status, cuerpo } = await pedir(`?q=${encodeURIComponent(q)}`);
    assert.equal(status, 200, q);
    assert.equal(cuerpo.data.comprobante.codigo_barras, "F-000123", q);
  }
});

test("TDSI-995: por NIT/CI salen las compras del cliente que se pueden devolver (sin las anuladas)", async () => {
  const { status, cuerpo } = await pedir("?q=1234567");
  assert.equal(status, 200);
  assert.equal(cuerpo.data.criterio, "nit");
  assert.deepEqual(cuerpo.data.compras.map((c) => c.numero), ["F-000123", "F-000125"]);
  assert.equal(cuerpo.data.compras[0].total, 57);
});

test("TDSI-996: una factura anulada o inexistente responde \"Comprobante no encontrado o anulado\"", async () => {
  for (const ruta of ["?q=F-000124", "?q=F-999999", "?q=7654321", "/F-000124", "/F-999999"]) {
    const { status, cuerpo } = await pedir(ruta);
    assert.equal(status, 404, ruta);
    assert.equal(cuerpo.mensaje, "Comprobante no encontrado o anulado", ruta);
  }
});

test("TDSI-68: una factura con anulacion pendiente no se puede devolver (409)", async () => {
  const { status, cuerpo } = await pedir("/F-000125");
  assert.equal(status, 409);
  assert.match(cuerpo.mensaje, /anulacion pendiente/);
});

test("TDSI-994: el detalle de una compra elegida de la lista sale por /comprobantes/:numero", async () => {
  const { status, cuerpo } = await pedir("/f-000123");
  assert.equal(status, 200);
  assert.equal(cuerpo.data.numero, "F-000123");
  assert.equal(cuerpo.data.items.length, 2);
});

test("TDSI-991: busqueda vacia o repetida responde 400; muy larga, el 400 de facturacion", async () => {
  assert.equal((await pedir("")).status, 400);
  assert.equal((await pedir("?q=%20%20")).status, 400);
  assert.equal((await pedir("?q=a&q=b")).status, 400);
  const larga = await pedir(`?q=${"x".repeat(101)}`);
  assert.equal(larga.status, 400);
  assert.match(larga.cuerpo.mensaje, /100 caracteres/);
});

test("TDSI-991: si facturacion falla, responde 502 con un mensaje claro", async () => {
  facturacionCaida = true;
  try {
    const { status, cuerpo } = await pedir("?q=F-000123");
    assert.equal(status, 502);
    assert.match(cuerpo.mensaje, /Facturacion/);
  } finally {
    facturacionCaida = false;
  }
});
