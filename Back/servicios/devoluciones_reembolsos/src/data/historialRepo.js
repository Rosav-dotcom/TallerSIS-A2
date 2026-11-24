const { query } = require("../config/db");

/**
 * TDSI-81/1124: linea de tiempo de una devolucion, en orden cronologico (a igual hora, en el
 * orden en que se registro). Solo se lee: el historial no se edita ni se borra (TDSI-239).
 */
async function listarPorDevolucion(devolucionId) {
  const { rows } = await query(
    `SELECT estado_anterior, estado_nuevo, cambiado_por, cambiado_en, comentario
       FROM devoluciones.historial_estados
      WHERE devolucion_id = $1
      ORDER BY cambiado_en, id`,
    [devolucionId]
  );
  return rows;
}

module.exports = { listarPorDevolucion };
