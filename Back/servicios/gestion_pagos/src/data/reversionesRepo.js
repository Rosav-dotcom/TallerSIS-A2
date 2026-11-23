const { query, withTransaction } = require("../config/db");

// TDSI-1026 (TDSI-74): acceso a pagos.reversiones (TDSI-225).
const num = (v) => (v === null || v === undefined ? null : Number(v));
const formatear = (r) => (r ? { ...r, id: Number(r.id), monto: num(r.monto) } : null);

/**
 * Registra la reversión en una sola transacción SQL, con las filas de la venta
 * bloqueadas (FOR UPDATE), igual que la anulación de ventas (TDSI-306): así dos
 * pedidos al mismo tiempo no pueden revertir la misma venta.
 * validar(filas) lanza AppError si la venta no se puede revertir y devuelve el monto.
 */
async function crear({ id_transaccion, motivo, solicitado_por, devolucion_id }, validar) {
  return withTransaction(async (client) => {
    const { rows: filas } = await client.query(
      `SELECT id, id_transaccion, metodo, monto, estado, estado_pago
         FROM pagos.transacciones
        WHERE id_transaccion = $1
        ORDER BY id
        FOR UPDATE`,
      [id_transaccion]
    );
    const { rows: previa } = await client.query(
      `SELECT id, estado FROM pagos.reversiones WHERE id_transaccion = $1`,
      [id_transaccion]
    );
    const monto = validar(filas.map((f) => ({ ...f, monto: num(f.monto) })), previa[0] || null);

    const { rows } = await client.query(
      `INSERT INTO pagos.reversiones (id_transaccion, monto, motivo, solicitado_por, devolucion_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id_transaccion, monto, motivo, solicitado_por, devolucion_id]
    );
    return formatear(rows[0]);
  });
}

async function obtener(id) {
  const { rows } = await query(`SELECT * FROM pagos.reversiones WHERE id = $1`, [id]);
  return formatear(rows[0]);
}

async function listar({ id_transaccion = null, devolucion_id = null, estado = null } = {}) {
  const { rows } = await query(
    `SELECT * FROM pagos.reversiones
      WHERE ($1::text IS NULL OR id_transaccion = $1)
        AND ($2::text IS NULL OR devolucion_id = $2)
        AND ($3::text IS NULL OR estado = $3)
      ORDER BY creado_en DESC
      LIMIT 200`,
    [id_transaccion, devolucion_id, estado]
  );
  return rows.map(formatear);
}

/** Pasa una reversión en ERROR a ENVIADA para reintentar; null si ya no estaba en ERROR. */
async function tomarParaReintento(id) {
  const { rows } = await query(
    `UPDATE pagos.reversiones
        SET estado = 'ENVIADA', actualizado_en = now()
      WHERE id = $1 AND estado = 'ERROR'
      RETURNING *`,
    [id]
  );
  return formatear(rows[0]);
}

async function registrarError(id, { intentos, error }) {
  const { rows } = await query(
    `UPDATE pagos.reversiones
        SET estado = 'ERROR', intentos = $2, ultimo_error = $3, actualizado_en = now()
      WHERE id = $1
      RETURNING *`,
    [id, intentos, String(error).slice(0, 300)]
  );
  return formatear(rows[0]);
}

/**
 * La pasarela confirmó: la reversión queda CONFIRMADA y, en la misma transacción,
 * las filas pagadas con Tarjeta pasan a 'Revertido' (dejan de sumar en los totales).
 */
async function confirmar(id, { intentos, referencia }) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE pagos.reversiones
          SET estado = 'CONFIRMADA', intentos = $2, referencia_pasarela = $3, ultimo_error = NULL,
              confirmado_en = now(), actualizado_en = now()
        WHERE id = $1
        RETURNING *`,
      [id, intentos, referencia]
    );
    const reversion = rows[0];
    await client.query(
      `UPDATE pagos.transacciones
          SET estado = 'Revertido', actualizado_en = now()
        WHERE id_transaccion = $1 AND metodo = 'Tarjeta' AND estado = 'Registrado'`,
      [reversion.id_transaccion]
    );
    return formatear(reversion);
  });
}

module.exports = { crear, obtener, listar, tomarParaReintento, registrarError, confirmar };
