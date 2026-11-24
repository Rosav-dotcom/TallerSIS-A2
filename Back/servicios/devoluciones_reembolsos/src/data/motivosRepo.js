const { query } = require("../config/db");

/** TDSI-71/1102: motivos activos, en el orden del selector. */
async function listarActivos() {
  const { rows } = await query(
    "SELECT id, nombre FROM devoluciones.motivos WHERE activo ORDER BY orden, id"
  );
  return rows;
}

/** TDSI-71: un motivo activo por su id; null si no existe o esta desactivado. */
async function buscarActivo(id) {
  const { rows } = await query("SELECT id, nombre FROM devoluciones.motivos WHERE id = $1 AND activo", [id]);
  return rows[0] || null;
}

module.exports = { listarActivos, buscarActivo };
