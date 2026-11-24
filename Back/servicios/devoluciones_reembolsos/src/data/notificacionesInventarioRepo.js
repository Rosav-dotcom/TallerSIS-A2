const { query } = require("../config/db");

// TDSI-77: aviso de cada devolucion a Inventario (devoluciones.notificaciones_inventario).
const COLUMNAS = `n.id, n.devolucion_id, d.codigo, n.version, n.estado, n.intentos, n.ultimo_intento_en,
                  n.ultimo_error, n.proximo_intento_en, n.pubsub_message_id, n.enviado_en,
                  n.resultado_motivo, n.resultado_en, n.creado_en`;

const aNotificacion = (f) => (f ? { ...f, id: Number(f.id), devolucion_id: Number(f.devolucion_id) } : null);

async function obtener(id, { conPayload = false } = {}) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}${conPayload ? ", n.payload" : ""}
       FROM devoluciones.notificaciones_inventario n
       JOIN devoluciones.devoluciones d ON d.id = n.devolucion_id
      WHERE n.id = $1`,
    [id]
  );
  return aNotificacion(rows[0]);
}

async function obtenerPorCodigo(codigo) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
       FROM devoluciones.notificaciones_inventario n
       JOIN devoluciones.devoluciones d ON d.id = n.devolucion_id
      WHERE d.codigo = $1`,
    [codigo]
  );
  return aNotificacion(rows[0]);
}

/**
 * TDSI-231: guarda el aviso (PENDIENTE) con la conexion de la transaccion que procesa la
 * devolucion (outbox). proximo_intento_en queda 2 minutos adelante: si el primer intento nunca
 * termina, el worker lo retoma. Una devolucion tiene un solo aviso.
 */
async function crearEnTransaccion(cliente, { devolucionId, payload }) {
  const { rows } = await cliente.query(
    `INSERT INTO devoluciones.notificaciones_inventario (devolucion_id, estado, payload, proximo_intento_en)
     VALUES ($1, 'PENDIENTE', $2, now() + interval '2 minutes')
     ON CONFLICT (devolucion_id) DO NOTHING
     RETURNING id`,
    [devolucionId, JSON.stringify(payload)]
  );
  return rows[0] ? Number(rows[0].id) : null;
}

async function marcarEnviado(id, messageId) {
  await query(
    `UPDATE devoluciones.notificaciones_inventario
        SET estado = 'ENVIADO', intentos = intentos + 1, ultimo_intento_en = now(), ultimo_error = NULL,
            pubsub_message_id = $2, proximo_intento_en = NULL, enviado_en = now()
      WHERE id = $1`,
    [id, messageId]
  );
  return obtener(id);
}

/** El intento fallo: queda PENDIENTE con el error, para el siguiente intento. */
async function registrarFallo(id, { error }) {
  await query(
    `UPDATE devoluciones.notificaciones_inventario
        SET intentos = intentos + 1, ultimo_intento_en = now(), ultimo_error = $2,
            proximo_intento_en = now() + interval '30 seconds'
      WHERE id = $1`,
    [id, String(error || "Error desconocido").slice(0, 400)]
  );
  return obtener(id);
}

module.exports = { obtener, obtenerPorCodigo, crearEnTransaccion, marcarEnviado, registrarFallo };
