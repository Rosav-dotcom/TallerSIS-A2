const { query } = require("../config/db");

// TDSI-82/241: datos del reporte de devoluciones y notas de credito. Los filtros llegan ya
// validados: inicio y fin son instantes (dias de Bolivia, inclusive); estado, motivoId y metodo
// (opcion de reembolso) son opcionales (null = todos).
const FILTROS_DEVOLUCION = `
        AND ($3::TEXT   IS NULL OR d.estado = $3)
        AND ($4::BIGINT IS NULL OR d.motivo_id = $4)
        AND ($5::TEXT   IS NULL OR d.opcion_reembolso = $5)`;

const parametros = ({ inicio, fin, estado = null, motivoId = null, metodo = null }) =>
  [inicio, fin, estado, motivoId, metodo];

/** Devoluciones registradas en el rango (fecha de solicitud), de la mas antigua a la mas nueva. */
async function devoluciones(filtros) {
  const { rows } = await query(
    `SELECT d.codigo, d.fecha_solicitud, d.factura_numero, d.cliente_nit, d.tipo, m.nombre AS motivo,
            d.estado, d.motivo_rechazo, d.metodo_pago_original, d.opcion_reembolso, d.monto_total, d.caja_id,
            d.creado_por, COALESCE(d.autorizado_por_nombre, d.autorizado_por) AS autorizado_por,
            nc.numero AS nota_credito
       FROM devoluciones.devoluciones d
       LEFT JOIN devoluciones.motivos m ON m.id = d.motivo_id
       LEFT JOIN LATERAL (
         SELECT n.numero FROM devoluciones.notas_credito n
          WHERE n.devolucion_id = d.id ORDER BY (n.estado = 'EMITIDA') DESC, n.id DESC LIMIT 1
       ) nc ON true
      WHERE d.fecha_solicitud >= $1 AND d.fecha_solicitud <= $2 ${FILTROS_DEVOLUCION}
      ORDER BY d.fecha_solicitud, length(d.codigo), d.codigo`,
    parametros(filtros)
  );
  return rows;
}

/**
 * Notas de credito emitidas en el rango (fecha de emision) cuya devolucion cumple los demas
 * filtros (estado, motivo y metodo de reembolso son de la devolucion).
 */
async function notasCredito(filtros) {
  const { rows } = await query(
    `SELECT n.numero, n.emitida_en, n.monto, n.estado, n.enviada_por_correo,
            d.codigo AS devolucion_codigo, d.factura_numero, d.cliente_nit, m.nombre AS motivo,
            d.opcion_reembolso, d.estado AS devolucion_estado
       FROM devoluciones.notas_credito n
       JOIN devoluciones.devoluciones d ON d.id = n.devolucion_id
       LEFT JOIN devoluciones.motivos m ON m.id = d.motivo_id
      WHERE n.emitida_en >= $1 AND n.emitida_en <= $2 ${FILTROS_DEVOLUCION}
      ORDER BY n.emitida_en, n.numero`,
    parametros(filtros)
  );
  return rows;
}

module.exports = { devoluciones, notasCredito };
