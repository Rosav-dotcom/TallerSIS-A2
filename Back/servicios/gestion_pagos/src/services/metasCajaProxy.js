// TDSI-650 (TDSI-640): KPI-6 lee "Metas de venta" de Gestión de caja (TDSI-58), que es la
// dueña de las metas: GET /api/metas?fecha=YYYY-MM-DD -> [{ caja_id, caja_nombre, vendido, meta, porcentaje }].
// La URL se lee en cada llamada para que los tests puedan apuntar a un Gestión de caja falso.

/** Devuelve las cajas con su meta del día; lanza un Error con un mensaje claro si falla. */
async function obtenerMetasDelDia(fecha) {
  const base = process.env.GESTION_CAJA_URL || "http://localhost:4004";
  let respuesta;
  try {
    respuesta = await fetch(`${base}/api/metas?fecha=${encodeURIComponent(fecha)}`, {
      signal: AbortSignal.timeout(Number(process.env.GESTION_CAJA_TIMEOUT_MS || 5000)),
    });
  } catch (e) {
    throw new Error("No se pudo contactar a Gestión de caja para leer las metas de venta.");
  }
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok || !datos || !Array.isArray(datos.data)) {
    throw new Error(datos?.mensaje || `Gestión de caja no pudo dar las metas de venta (HTTP ${respuesta.status}).`);
  }
  return datos.data;
}

module.exports = { obtenerMetasDelDia };
