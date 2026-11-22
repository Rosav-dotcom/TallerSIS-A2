const { query } = require("../config/db");

// TDSI-68/992: cada fila es una cuenta del login de administracion con su rol
// (ADMINISTRADOR, ENCARGADO_DEVOLUCIONES o USUARIO_SOPORTE).
const COLUMNAS = "id, cajero_id, usuario, nombre, rol, activo";

async function buscarPorCajeroId(cajero_id) {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM caja.administradores WHERE cajero_id = $1`,
    [cajero_id]
  );
  return rows[0] || null;
}

async function buscarPorUsuario(usuario) {
  const { rows } = await query(`SELECT ${COLUMNAS} FROM caja.administradores WHERE usuario = $1`, [usuario]);
  return rows[0] || null;
}

/** TDSI-992: cuenta nueva del login de administracion (el Administrador la crea en "Usuarios"). */
async function crear({ cajero_id, usuario, nombre, rol }) {
  const { rows } = await query(
    `INSERT INTO caja.administradores (cajero_id, usuario, nombre, rol) VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS}`,
    [cajero_id, usuario, nombre, rol]
  );
  return rows[0];
}

/** TDSI-992: cuentas de esos roles, para la pantalla "Usuarios". */
async function listarPorRoles(roles) {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM caja.administradores WHERE rol = ANY($1) ORDER BY nombre`,
    [roles]
  );
  return rows;
}

async function actualizar(cajero_id, { usuario, nombre }) {
  const { rows } = await query(
    `UPDATE caja.administradores SET usuario = $2, nombre = $3 WHERE cajero_id = $1 RETURNING ${COLUMNAS}`,
    [cajero_id, usuario, nombre]
  );
  return rows[0] || null;
}

async function cambiarEstado(cajero_id, activo) {
  const { rows } = await query(
    `UPDATE caja.administradores SET activo = $2 WHERE cajero_id = $1 RETURNING ${COLUMNAS}`,
    [cajero_id, activo]
  );
  return rows[0] || null;
}

module.exports = { buscarPorCajeroId, buscarPorUsuario, crear, listarPorRoles, actualizar, cambiarEstado };
