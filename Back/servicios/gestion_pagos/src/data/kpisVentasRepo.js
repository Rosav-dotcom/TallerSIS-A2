const { query } = require("../config/db");
const { CTE_HISTORIAL } = require("./historialCajerosRepo");
const metodosPagoRepo = require("./metodosPagoRepo");

// TDSI-650 (TDSI-640): datos de la pestaña "Ventas" del Tablero de KPIs.
// KPI-1 y KPI-2 reutilizan el historial de cajeros (TDSI-19/33, CTE_HISTORIAL): la misma
// definición de venta (un id_transaccion, un mixto cuenta una vez) y de estado
// (APROBADA, ANULADA, RECHAZADA, PENDIENTE). KPI-5 reutiliza el monitoreo por método (TDSI-34)
// y KPI-8 lee pagos.ventas_canceladas (TDSI-45).
// filtros: { desde, hasta (YYYY-MM-DD, inclusive, días de Bolivia), cajaId, cajeroId }

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

// $1 desde, $2 hasta, $3 cajero_id, $4 caja_id; metodo, revisión y supervisor van sin filtro
const paramsHistorial = ({ desde, hasta, cajeroId = null, cajaId = null }) => [desde, hasta, cajeroId, cajaId, null, null, null];

/** KPI-1: ventas cobradas (APROBADAS) y su monto, por día. */
async function ventasCobradasPorDia(filtros) {
  const { rows } = await query(
    `WITH ${CTE_HISTORIAL}
     SELECT fecha_local                                                AS fecha,
            COUNT(*) FILTER (WHERE estado = 'APROBADA')::int           AS cantidad,
            COALESCE(SUM(total) FILTER (WHERE estado = 'APROBADA'), 0) AS monto
       FROM historial
      GROUP BY fecha_local
     HAVING COUNT(*) FILTER (WHERE estado = 'APROBADA') > 0
      ORDER BY fecha_local`,
    paramsHistorial(filtros)
  );
  return rows.map((r) => ({ fecha: r.fecha, cantidad: r.cantidad, monto: num(r.monto) }));
}

/** KPI-2: por cajero, facturas emitidas (APROBADAS + ANULADAS), anuladas y Bs anulados. */
async function anulacionPorCajero(filtros) {
  const { rows } = await query(
    `WITH ${CTE_HISTORIAL}
     SELECT cajero_id,
            MAX(cajero)                                                       AS cajero,
            COUNT(*) FILTER (WHERE estado IN ('APROBADA', 'ANULADA'))::int    AS emitidas,
            COUNT(*) FILTER (WHERE estado = 'ANULADA')::int                   AS anuladas,
            COALESCE(SUM(total) FILTER (WHERE estado = 'ANULADA'), 0)         AS monto_anulado
       FROM historial
      GROUP BY cajero_id
     HAVING COUNT(*) FILTER (WHERE estado IN ('APROBADA', 'ANULADA')) > 0
      ORDER BY cajero_id`,
    paramsHistorial(filtros)
  );
  return rows.map((r) => ({ ...r, monto_anulado: num(r.monto_anulado) }));
}

/** KPI-5: monto y cantidad por método de las ventas cobradas (el mismo cálculo de GET /api/pagos/metodos). */
async function montosPorMetodo(filtros) {
  const filas = await metodosPagoRepo.agruparPorMetodo(filtros);
  return filas.map((f) => ({ metodo: f.metodo, monto: num(f.monto), cantidad: f.cantidad }));
}

/** KPI-8: ventas canceladas antes del cobro, por motivo. */
async function canceladasPorMotivo({ desde, hasta, cajeroId = null, cajaId = null }) {
  const { rows } = await query(
    `SELECT motivo, COUNT(*)::int AS cantidad, COALESCE(SUM(total), 0) AS monto
       FROM pagos.ventas_canceladas
      WHERE creado_en >= ($1::date)::timestamp AT TIME ZONE 'America/La_Paz'
        AND creado_en <  ($2::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
        AND ($3::text IS NULL OR cajero_id = $3)
        AND ($4::text IS NULL OR caja_id = $4)
      GROUP BY motivo`,
    [desde, hasta, cajeroId, cajaId]
  );
  return rows.map((r) => ({ motivo: r.motivo, cantidad: r.cantidad, monto: num(r.monto) }));
}

module.exports = { ventasCobradasPorDia, anulacionPorCajero, montosPorMetodo, canceladasPorMotivo };
