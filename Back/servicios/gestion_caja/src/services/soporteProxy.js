const { AppError } = require("../utils/AppError");

// TDSI-639/1130 (KPI-10): los incidentes viven en el microservicio soporte; gestion_caja NUNCA
// lee su esquema, solo consulta por HTTP (mismo patron que devolucionesProxy.js). Soporte pide
// el token del Administrador: se reenvia el mismo Authorization con que se pidio el KPI.
const SOPORTE_URL = (process.env.SOPORTE_URL || "http://localhost:4007").replace(/\/+$/, "");
const LIMITE = 100; // maximo por pagina de GET /api/soporte/tickets
const MAX_PAGINAS = 50;

/**
 * GET /api/soporte/tickets?desde=&hasta= (bandeja, TDSI-671/674): todos los tickets registrados
 * en el periodo, pagina por pagina. Cada uno trae numero, prioridad, estado, creado_en y
 * resuelto_en.
 */
async function listarTickets({ desde, hasta, authorization }) {
  const tickets = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const params = new URLSearchParams({ desde, hasta, limite: String(LIMITE), pagina: String(pagina) });
    let respuesta;
    try {
      respuesta = await fetch(`${SOPORTE_URL}/api/soporte/tickets?${params}`, {
        headers: authorization ? { Authorization: authorization } : {},
      });
    } catch (e) {
      throw new AppError("No se pudo consultar a Soporte en este momento. Intente de nuevo.", 502);
    }
    const datos = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !Array.isArray(datos?.data)) {
      throw new AppError("Soporte no pudo responder los tickets del periodo.", 502, {
        status: respuesta.status, mensaje: datos?.mensaje ?? null,
      });
    }
    tickets.push(...datos.data);
    if (pagina >= (datos.paginacion?.paginas ?? 1)) return tickets;
  }
  return tickets;
}

module.exports = { listarTickets, LIMITE };
