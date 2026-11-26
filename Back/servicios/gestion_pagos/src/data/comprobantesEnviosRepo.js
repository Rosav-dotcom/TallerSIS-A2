const { query } = require("../config/db");

// TDSI-79/1121: acceso a pagos.comprobantes_envios (estado de cada correo de una devolución).
// Un envío que quedó en Pendiente más de este tiempo (el proceso se cayó a la mitad) se puede reenviar.
const PENDIENTE_VENCIDO = "2 minutes";

const formatear = (r) => (r ? { ...r, id: Number(r.id) } : null);

async function crear({ tipo, devolucion_id, email, nota_credito, datos }) {
  const { rows } = await query(
    `INSERT INTO pagos.comprobantes_envios (tipo, devolucion_id, email, nota_credito, datos)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tipo, devolucion_id, email, nota_credito, JSON.stringify(datos)]
  );
  return formatear(rows[0]);
}

/** Guarda cómo terminó un intento: Enviado (con su fecha) o Error (con el motivo). */
async function registrarResultado(id, { estado, simulado = false, error = null }) {
  const { rows } = await query(
    `UPDATE pagos.comprobantes_envios
        SET estado = $2::varchar,
            simulado = $3,
            ultimo_error = $4,
            intentos = intentos + 1,
            enviado_en = CASE WHEN $2::varchar = 'Enviado' THEN now() ELSE enviado_en END,
            actualizado_en = now()
      WHERE id = $1
      RETURNING *`,
    [id, estado, simulado, error ? String(error).slice(0, 300) : null]
  );
  return formatear(rows[0]);
}

/**
 * Para reenviar: lo vuelve a poner en Pendiente (y corrige el correo si llega uno nuevo)
 * en una sola sentencia, así dos clics en "Reenviar" no mandan dos correos a la vez.
 * Devuelve null si no existe o si ya hay un envío en curso.
 */
async function tomarParaReenvio(id, email = null) {
  const { rows } = await query(
    `UPDATE pagos.comprobantes_envios
        SET estado = 'Pendiente',
            email = COALESCE($2, email),
            actualizado_en = now()
      WHERE id = $1
        AND (estado <> 'Pendiente' OR actualizado_en < now() - interval '${PENDIENTE_VENCIDO}')
      RETURNING *`,
    [id, email]
  );
  return formatear(rows[0]);
}

async function obtener(id) {
  const { rows } = await query(`SELECT * FROM pagos.comprobantes_envios WHERE id = $1`, [id]);
  return formatear(rows[0]);
}

async function listar({ devolucion_id = null, estado = null } = {}) {
  const { rows } = await query(
    `SELECT * FROM pagos.comprobantes_envios
      WHERE ($1::text IS NULL OR devolucion_id = $1)
        AND ($2::text IS NULL OR estado = $2)
      ORDER BY creado_en DESC, id DESC
      LIMIT 200`,
    [devolucion_id, estado]
  );
  return rows.map(formatear);
}

module.exports = { crear, registrarResultado, tomarParaReenvio, obtener, listar };
