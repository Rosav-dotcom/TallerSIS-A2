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

/**
 * TDSI-1039: el intento fallo. Si es reintentable y quedan intentos sigue PENDIENTE con espera
 * creciente (base, base*2, base*4...); si no, o si ya se hicieron maxIntentos, queda en ERROR
 * (con el boton "Reenviar", TDSI-1041).
 */
async function registrarFallo(id, { error, reintentable }, maxIntentos, backoffBaseSeg) {
  await query(
    `UPDATE devoluciones.notificaciones_inventario
        SET intentos = intentos + 1,
            ultimo_intento_en = now(),
            ultimo_error = $2,
            estado = CASE WHEN NOT $3::boolean OR intentos + 1 >= $4::int THEN 'ERROR' ELSE 'PENDIENTE' END,
            proximo_intento_en = CASE WHEN NOT $3::boolean OR intentos + 1 >= $4::int THEN NULL
                                      ELSE now() + make_interval(secs => $5::int * power(2, intentos)) END
      WHERE id = $1`,
    [id, String(error || "Error desconocido").slice(0, 400), Boolean(reintentable), maxIntentos, backoffBaseSeg]
  );
  return obtener(id);
}

/** Deja el aviso PENDIENTE para mas tarde sin contar un intento (p. ej. sin topico configurado). */
async function posponer(id, segundos, motivo) {
  await query(
    `UPDATE devoluciones.notificaciones_inventario
        SET ultimo_error = $3, proximo_intento_en = now() + make_interval(secs => $2::int)
      WHERE id = $1 AND estado = 'PENDIENTE'`,
    [id, segundos, motivo]
  );
  return obtener(id);
}

/**
 * TDSI-1039: toma los avisos PENDIENTES vencidos y los reserva 2 minutos (SKIP LOCKED: dos
 * workers, o dos instancias del servicio, nunca toman el mismo aviso).
 */
async function tomarPendientes(limite = 10) {
  const { rows } = await query(
    `UPDATE devoluciones.notificaciones_inventario
        SET proximo_intento_en = now() + interval '2 minutes'
      WHERE id IN (
        SELECT id FROM devoluciones.notificaciones_inventario
         WHERE estado = 'PENDIENTE' AND proximo_intento_en <= now()
         ORDER BY proximo_intento_en
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id`,
    [limite]
  );
  return Promise.all(rows.map((r) => obtener(r.id, { conPayload: true })));
}

/**
 * TDSI-1040: guarda el acuse de Inventario (CONFIRMADO o RECHAZADO con su motivo). Llega aunque el
 * aviso figure PENDIENTE o ERROR (Inventario lo recibio igual): deja de reintentarse.
 */
async function registrarAcuse({ id, estado, motivo }) {
  await query(
    `UPDATE devoluciones.notificaciones_inventario
        SET estado = $2, resultado_motivo = $3, resultado_en = now(), proximo_intento_en = NULL
      WHERE id = $1`,
    [id, estado, motivo]
  );
  return obtener(id);
}

module.exports = {
  obtener, obtenerPorCodigo, crearEnTransaccion, marcarEnviado, registrarFallo, posponer, tomarPendientes, registrarAcuse,
};
