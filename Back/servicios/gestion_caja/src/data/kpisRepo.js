const { query } = require("../config/db");

// TDSI-639: datos de los KPIs de la pestaña "Caja". Filtros ya validados: inicio y fin
// (instantes del periodo), caja_id y cajero_id (null = todos).

/**
 * TDSI-643 (KPI-3): turnos CERRADOS en el periodo (por la hora de cierre), por cajero, con
 * cuantos cuadran, cuantos tienen faltante o sobrante y cuantos se cerraron sin arqueo
 * (tipo_diferencia vacio).
 */
async function arqueoPorCajero({ inicio, fin, caja_id: cajaId = null, cajero_id: cajeroId = null }) {
  const { rows } = await query(
    `SELECT t.cajero_id, MAX(t.cajero_nombre) AS cajero_nombre,
            COUNT(*)::int                                              AS cerrados,
            COUNT(*) FILTER (WHERE t.tipo_diferencia = 'CUADRA')::int   AS cuadran,
            COUNT(*) FILTER (WHERE t.tipo_diferencia = 'FALTANTE')::int AS faltantes,
            COUNT(*) FILTER (WHERE t.tipo_diferencia = 'SOBRANTE')::int AS sobrantes,
            COUNT(*) FILTER (WHERE t.tipo_diferencia IS NULL)::int      AS sin_arqueo
       FROM caja.turnos t
      WHERE t.estado = 'CERRADO' AND t.cerrado_en >= $1 AND t.cerrado_en <= $2
        AND ($3::TEXT IS NULL OR t.caja_id = $3)
        AND ($4::TEXT IS NULL OR t.cajero_id = $4)
      GROUP BY t.cajero_id
      ORDER BY MAX(t.cajero_nombre) NULLS LAST, t.cajero_id`,
    [inicio, fin, cajaId, cajeroId]
  );
  return rows;
}

/**
 * TDSI-1090 (KPI-4): solicitudes de apertura o cierre (caja.autorizaciones) APROBADAS o
 * RECHAZADAS en el periodo (por la hora en que se resolvieron), con su tiempo de respuesta
 * en segundos = resuelto_en - solicitado_en. Agrupadas por mes (hora de Bolivia) y tipo.
 */
async function autorizacionesResueltas({ inicio, fin, caja_id: cajaId = null, cajero_id: cajeroId = null }) {
  const { rows } = await query(
    `SELECT to_char(a.resuelto_en AT TIME ZONE 'America/La_Paz', 'YYYY-MM') AS mes, a.tipo,
            COUNT(*)::int AS resueltas,
            COUNT(*) FILTER (WHERE a.estado = 'APROBADA')::int AS aprobadas,
            SUM(EXTRACT(EPOCH FROM (a.resuelto_en - a.solicitado_en)))::float AS segundos
       FROM caja.autorizaciones a
      WHERE a.estado IN ('APROBADA', 'RECHAZADA') AND a.resuelto_en IS NOT NULL
        AND a.resuelto_en >= $1 AND a.resuelto_en <= $2
        AND ($3::TEXT IS NULL OR a.caja_id = $3)
        AND ($4::TEXT IS NULL OR a.cajero_id = $4)
      GROUP BY 1, 2
      ORDER BY 1, 2`,
    [inicio, fin, cajaId, cajeroId]
  );
  return rows;
}

module.exports = { arqueoPorCajero, autorizacionesResueltas };
