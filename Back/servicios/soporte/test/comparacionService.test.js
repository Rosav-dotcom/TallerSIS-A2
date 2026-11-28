// TDSI-973: el servicio de comparación con los servicios de factura y transacción simulados
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearComparacionService } = require("../src/services/comparacionService");
const { AppError } = require("../src/utils/AppError");

const FACTURA = {
  numero: "F-000123", venta_id: "TX-1", estado: "Emitida", total: 100,
  cliente: { nit: "1", nombre: "Juan" }, metodos_pago: [{ metodo: "QR", monto: 100 }],
};
const TRANSACCION = {
  id_transaccion: "TX-1", estado: "Registrado", estado_pago: "APROBADA", total: 100,
  metodos: [{ metodo: "QR", monto: 100 }], cliente: { nit: "1", razon_social: "Juan" }, historial: [],
};

function armar({ factura = FACTURA, transaccion = async () => TRANSACCION } = {}) {
  const pedidas = [];
  const servicio = crearComparacionService({
    facturasService: { consultarFactura: async () => factura },
    transaccionesService: { consultarTransaccion: async (id) => { pedidas.push(id); return transaccion(id); } },
  });
  return { servicio, pedidas };
}

test("sin número de factura responde 400", async () => {
  const { servicio } = armar();
  await assert.rejects(servicio.comparar({ transaccion: "TX-1" }), (e) => e.status === 400);
});

test("sin ID de transacción usa el venta_id de la factura", async () => {
  const { servicio, pedidas } = armar();
  const r = await servicio.comparar({ factura: "F-000123" });
  assert.deepEqual(pedidas, ["TX-1"]);
  assert.equal(r.coincide, true);
  assert.equal(r.factura.numero, "F-000123");
  assert.equal(r.transaccion.id_transaccion, "TX-1");
});

test("el ID de transacción enviado tiene prioridad sobre el de la factura", async () => {
  const { servicio, pedidas } = armar({ transaccion: async (id) => ({ ...TRANSACCION, id_transaccion: id }) });
  const r = await servicio.comparar({ factura: "F-000123", transaccion: "TX-7" });
  assert.deepEqual(pedidas, ["TX-7"]);
  assert.ok(r.diferencias.some((d) => d.campo === "referencia"));
});

test("factura sin venta_id y sin transacción enviada responde 400", async () => {
  const { servicio } = armar({ factura: { ...FACTURA, venta_id: null } });
  await assert.rejects(servicio.comparar({ factura: "F-000123" }), (e) => e.status === 400);
});

test("transacción inexistente (404) se devuelve como diferencia, no como error", async () => {
  const { servicio } = armar({ transaccion: async () => { throw new AppError("Transacción no encontrada", 404); } });
  const r = await servicio.comparar({ factura: "F-000123" });
  assert.equal(r.transaccion, null);
  assert.equal(r.coincide, false);
  assert.equal(r.diferencias[0].campo, "transaccion");
});

test("si gestion_pagos no responde (503) el error se propaga", async () => {
  const { servicio } = armar({ transaccion: async () => { throw new AppError("No se pudo conectar", 503); } });
  await assert.rejects(servicio.comparar({ factura: "F-000123" }), (e) => e.status === 503);
});
