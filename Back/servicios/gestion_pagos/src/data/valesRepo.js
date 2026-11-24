const { query } = require("../config/db");

// TDSI-75: acceso a pagos.vales_compra (TDSI-227).
// expira_en se devuelve como texto AAAA-MM-DD (es un día de Bolivia, no una hora) y
// dias_restantes se calcula contra el día de hoy en Bolivia.
const HOY = `(now() AT TIME ZONE 'America/La_Paz')::date`;
const COLUMNAS = `id, codigo, monto, saldo, estado, emitido_en,
  to_char(expira_en, 'YYYY-MM-DD') AS expira_en,
  (expira_en - ${HOY}) AS dias_restantes,
  devolucion_id, emitido_por, actualizado_en`;

const formatear = (fila) =>
  fila ? { ...fila, id: Number(fila.id), monto: Number(fila.monto), saldo: Number(fila.saldo), dias_restantes: Number(fila.dias_restantes) } : null;

/**
 * TDSI-1032: inserta el vale con saldo = monto y vencimiento dentro de "dias" días (de Bolivia).
 * Si el código ya existe, PostgreSQL responde 23505 y el servicio prueba con otro.
 */
async function crear({ codigo, monto, dias, devolucion_id, emitido_por }) {
  const { rows } = await query(
    `INSERT INTO pagos.vales_compra (codigo, monto, saldo, expira_en, devolucion_id, emitido_por)
     VALUES ($1, $2, $2, ${HOY} + $3::int, $4, $5)
     RETURNING ${COLUMNAS}`,
    [codigo, monto, dias, devolucion_id, emitido_por]
  );
  return formatear(rows[0]);
}

/** TDSI-1081: un vale por su código. null si no existe. */
async function obtener(codigo) {
  const { rows } = await query(`SELECT ${COLUMNAS} FROM pagos.vales_compra WHERE codigo = $1`, [codigo]);
  return formatear(rows[0]);
}

/** TDSI-1081: vales para la tabla de la pantalla, del más nuevo al más antiguo (máx. 100). */
async function listar({ estado = null, codigo = null, devolucion_id = null } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS} FROM pagos.vales_compra
      WHERE ($1::text IS NULL OR estado = $1)
        AND ($2::text IS NULL OR codigo LIKE $2)
        AND ($3::text IS NULL OR devolucion_id = $3)
      ORDER BY emitido_en DESC, id DESC
      LIMIT 100`,
    [estado, codigo, devolucion_id]
  );
  return rows.map(formatear);
}

module.exports = { crear, obtener, listar, formatear, COLUMNAS, HOY };
