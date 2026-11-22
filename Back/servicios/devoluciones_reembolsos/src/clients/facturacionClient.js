const { AppError } = require("../utils/AppError");

// TDSI-68/991: Devoluciones no duplica las facturas -- el comprobante de venta (factura,
// items y metodos de pago) vive en el microservicio facturacion y se consulta por HTTP.
const FACTURACION_URL = (process.env.FACTURACION_URL || "http://localhost:4002").replace(/\/+$/, "");

async function pedir(ruta) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}${ruta}`);
  } catch (e) {
    throw new AppError("No se pudo consultar a Facturacion. Intente de nuevo.", 502);
  }
  const datos = await respuesta.json().catch(() => null);
  return { status: respuesta.status, ok: respuesta.ok, datos };
}

/** GET /api/facturas/buscar?q= -> { criterio: "numero"|"nit"|"cliente", facturas: [...] } */
async function buscarFacturas(q) {
  const r = await pedir(`/api/facturas/buscar?${new URLSearchParams({ q })}`);
  if (!r.ok) {
    // Un 400 de facturacion (busqueda vacia o muy larga) se le muestra igual al Encargado.
    if (r.status === 400) throw new AppError(r.datos?.mensaje || "Busqueda invalida.", 400);
    throw new AppError("Facturacion no pudo buscar el comprobante.", 502, { status: r.status });
  }
  return r.datos.data;
}

/** GET /api/facturas/:numero -> factura con items, metodosPago y codigo_barras; null si no existe. */
async function obtenerFactura(numero) {
  const r = await pedir(`/api/facturas/${encodeURIComponent(numero)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new AppError("Facturacion no pudo devolver el comprobante.", 502, { status: r.status });
  return r.datos.data;
}

module.exports = { buscarFacturas, obtenerFactura };
