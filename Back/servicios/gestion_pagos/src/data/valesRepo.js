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

module.exports = { crear, formatear, COLUMNAS, HOY };
