const { AppError } = require("../utils/AppError");

const FORMATO_NUMERO = /^[A-Za-z0-9-]{1,30}$/;
const num = (v) => (v === null || v === undefined ? null : Number(v));

// TDSI-1064: vista de solo lectura de una factura para el Usuario de Soporte.
// Devuelve solo lo que Soporte necesita revisar (no expone columnas internas).
function aVistaFactura(f) {
  return {
    numero: f.numero,
    venta_id: f.venta_id ?? null,
    canal: f.canal ?? null,
    fecha: f.fecha,
    estado: f.estado,
    cliente: { nit: f.cliente_nit ?? null, nombre: f.cliente_nombre ?? null },
    subtotal: num(f.subtotal),
    descuento: num(f.descuento),
    impuesto: num(f.impuesto),
    total: num(f.total),
    items: (f.items || []).map((it) => ({
      descripcion: it.descripcion,
      cantidad: num(it.cantidad),
      precio_unitario: num(it.precio_unitario),
      subtotal: num(it.subtotal),
    })),
    metodos_pago: (f.metodosPago || []).map((m) => ({ metodo: m.metodo, monto: num(m.monto) })),
  };
}

function crearFacturasService({ facturacionClient }) {
  return {
    async consultarFactura(numero) {
      const valor = String(numero || "").trim();
      if (!FORMATO_NUMERO.test(valor)) {
        throw new AppError("Número de factura inválido", 400, "Use el formato de facturación, por ejemplo F-000123");
      }
      const factura = await facturacionClient.obtenerFactura(valor);
      if (!factura) throw new AppError("Factura no encontrada", 404);
      return aVistaFactura(factura);
    },
  };
}

module.exports = { crearFacturasService, aVistaFactura };
