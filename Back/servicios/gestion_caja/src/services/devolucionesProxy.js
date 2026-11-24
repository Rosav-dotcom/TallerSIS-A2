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

/**
 * TDSI-639/1130 (KPI-9): GET /api/devoluciones/reportes?desde=&hasta= (TDSI-82) -> devoluciones
 * registradas en el periodo con su estado, tipo, motivo, monto y caja.
 */
async function obtenerReporteDevoluciones({ desde, hasta }) {
  let respuesta;
  try {
    respuesta = await fetch(`${DEVOLUCIONES_URL}/api/devoluciones/reportes?${new URLSearchParams({ desde, hasta })}`);
  } catch (e) {
    throw new AppError("No se pudo consultar a Devoluciones en este momento. Intente de nuevo.", 502);
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos?.data) {
    throw new AppError("Devoluciones no pudo responder el reporte del periodo.", 502, { status: respuesta.status });
  }
  return datos.data;
}

module.exports = { obtenerDevolucionesDelDia, obtenerReporteDevoluciones };
