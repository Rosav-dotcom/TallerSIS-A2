const { AppError } = require("../utils/AppError");

// TDSI-80/1069: las devoluciones viven en el microservicio devoluciones_reembolsos; gestion_caja
// NUNCA lee su esquema, solo consulta por HTTP (mismo patron que supervisorProxy.js).
const DEVOLUCIONES_URL = (process.env.DEVOLUCIONES_URL || "http://localhost:4008").replace(/\/+$/, "");

/** GET /api/devoluciones/del-dia?fecha= -> { fecha, devoluciones: [...] } (sin las rechazadas). */
async function obtenerDevolucionesDelDia(fecha) {
  let respuesta;
  try {
    respuesta = await fetch(`${DEVOLUCIONES_URL}/api/devoluciones/del-dia?${new URLSearchParams({ fecha })}`);
  } catch (e) {
    throw new AppError("No se pudo consultar a Devoluciones en este momento. Intente de nuevo.", 502);
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    if (respuesta.status === 400) throw new AppError(datos?.mensaje || "Fecha invalida.", 400);
    throw new AppError("Devoluciones no pudo responder el resumen del dia.", 502, { status: respuesta.status });
  }
  return datos.data;
}

module.exports = { obtenerDevolucionesDelDia };
