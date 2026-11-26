const { query } = require("../config/db");

// TDSI-67: lectura de soporte.incidentes para el reporte de incidencias.
// Solo trae las columnas que usa el cálculo (reporteIncidentes.js). Las condiciones de
// fecha las arma ticketsService.construirFiltros, las mismas de la bandeja (PA TDSI-988).
const MAXIMO_FILAS = 50000;

async function incidentesDelRango({ condiciones = [], params = [] }) {
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT numero, tipo, estado, prioridad, creado_en, resuelto_en
       FROM soporte.incidentes
       ${where}
      ORDER BY creado_en
      LIMIT ${MAXIMO_FILAS}`,
    params
  );
  return rows;
}

module.exports = { incidentesDelRango, MAXIMO_FILAS };
