const { query } = require("../config/db");

/** TDSI-69/1097: fila de devoluciones.configuracion; null si esa clave no existe. */
async function obtener(clave) {
  const { rows } = await query(
    "SELECT clave, valor, actualizado_en, actualizado_por FROM devoluciones.configuracion WHERE clave = $1",
    [clave]
  );
  return rows[0] || null;
}

module.exports = { obtener };
