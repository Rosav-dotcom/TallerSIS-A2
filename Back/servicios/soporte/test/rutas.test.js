// TDSI-973: rutas de Soporte por HTTP, con servicios simulados
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { crearSoporteRoutes } = require("../src/routes/soporteRoutes");
const { crearFacturasService } = require("../src/services/facturasService");
const { errorHandler } = require("../src/middlewares/errorHandler");
const { AppError } = require("../src/utils/AppError");

let servidor;
let base;

test.before(async () => {
  const facturasService = crearFacturasService({
    facturacionClient: {
      obtenerFactura: async (n) =>
        n === "F-000123"
          ? { id: 1, numero: n, venta_id: "TX-1", estado: "Emitida", total: "100.00", cliente_nit: "1", cliente_nombre: "Juan",
              items: [{ descripcion: "Mesa", cantidad: 1, precio_unitario: "100.00", subtotal: "100.00" }],
              metodosPago: [{ metodo: "QR", monto: "100.00" }] }
          : null,
    },
  });
  const transaccionesService = {
    consultarTransaccion: async (id) => {
      if (id !== "TX-1") throw new AppError("Transacción no encontrada", 404);
      return { id_transaccion: "TX-1", estado: "Registrado", estado_pago: "APROBADA", total: 100,
               metodos: [{ metodo: "QR", monto: 100 }], cliente: { nit: "1", razon_social: "Juan" }, historial: [] };
    },
  };
  const comparacionService = require("../src/services/comparacionService").crearComparacionService({ facturasService, transaccionesService });

  const app = express();
  app.use("/api/soporte", crearSoporteRoutes({ facturasService, transaccionesService, comparacionService }));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://127.0.0.1:${servidor.address().port}/api/soporte`;
});

test.after(() => servidor.close());

const pedir = async (ruta) => {
  const r = await fetch(base + ruta);
  return { status: r.status, cuerpo: await r.json() };
};

test("GET /facturas/:numero devuelve la vista de solo lectura con números", async () => {
  const { status, cuerpo } = await pedir("/facturas/F-000123");
  assert.equal(status, 200);
  assert.equal(cuerpo.data.total, 100);
  assert.deepEqual(cuerpo.data.cliente, { nit: "1", nombre: "Juan" });
  assert.deepEqual(cuerpo.data.metodos_pago, [{ metodo: "QR", monto: 100 }]);
  assert.equal(cuerpo.data.id, undefined); // no expone el id interno de facturación
});

test("GET /facturas/:numero: 404 si no existe y 400 si el número es inválido", async () => {
  assert.equal((await pedir("/facturas/F-999")).status, 404);
  assert.equal((await pedir("/facturas/F%201%3B")).status, 400);
});

test("GET /transacciones/:id: 200 y 404", async () => {
  assert.equal((await pedir("/transacciones/TX-1")).cuerpo.data.total, 100);
  assert.equal((await pedir("/transacciones/TX-9")).status, 404);
});

test("GET /comparacion: coincide, diferencia por transacción inexistente y 400 sin factura", async () => {
  assert.equal((await pedir("/comparacion?factura=F-000123")).cuerpo.data.coincide, true);
  const otra = await pedir("/comparacion?factura=F-000123&transaccion=TX-9");
  assert.equal(otra.status, 200);
  assert.equal(otra.cuerpo.data.diferencias[0].campo, "transaccion");
  assert.equal((await pedir("/comparacion?transaccion=TX-1")).status, 400);
  assert.equal((await pedir("/comparacion?factura=F-999")).status, 404);
});
