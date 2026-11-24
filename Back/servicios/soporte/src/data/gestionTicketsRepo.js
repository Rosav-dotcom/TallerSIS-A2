const { query, withTransaction } = require("../config/db");
const { formatear } = require("./ticketsRepo");

// TDSI-64: detalle de un ticket y sus cambios. Cada cambio de tipo, prioridad o estado se
// guarda junto con su línea en soporte.incidentes_historial, en la MISMA transacción.

const COLUMNAS_DETALLE = `id, numero, tipo, referencia_tipo, referencia, descripcion, estado, prioridad,
  usuario_afectado, registrado_por, creado_en, actualizado_en, resuelto_en, cerrado_en,
  solucion, solucion_registrada_por`;

async function obtener(numero) {
  const { rows } = await query(`SELECT ${COLUMNAS_DETALLE} FROM soporte.incidentes WHERE numero = $1`, [numero]);
  return formatear(rows[0]);
}

/**
 * Cambia un campo del ticket (tipo o prioridad) y registra el cambio en el historial.
 * Devuelve null si el ticket no existe; { sinCambio: true, ticket } si ya tenía ese valor.
 */
async function cambiarCampo(numero, campo, valor, usuario) {
  if (!["tipo", "prioridad"].includes(campo)) throw new Error(`Campo no permitido: ${campo}`);
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, ${campo} AS actual FROM soporte.incidentes WHERE numero = $1 FOR UPDATE`,
      [numero]
    );
    const fila = rows[0];
    if (!fila) return null;
    if (fila.actual === valor) {
      const { rows: igual } = await client.query(`SELECT ${COLUMNAS_DETALLE} FROM soporte.incidentes WHERE id = $1`, [fila.id]);
      return { sinCambio: true, ticket: formatear(igual[0]) };
    }

    const { rows: actualizado } = await client.query(
      `UPDATE soporte.incidentes SET ${campo} = $2, actualizado_en = now() WHERE id = $1 RETURNING ${COLUMNAS_DETALLE}`,
      [fila.id, valor]
    );
    await client.query(
      `INSERT INTO soporte.incidentes_historial (incidente_id, campo, valor_anterior, valor_nuevo, usuario)
       VALUES ($1, $2, $3, $4, $5)`,
      [fila.id, campo, fila.actual, valor, usuario]
    );
    return { sinCambio: false, ticket: formatear(actualizado[0]) };
  });
}

/**
 * TDSI-693: cambia el estado con la fila bloqueada. validar({ actual, tieneSolucion }) lanza
 * un error si no se permite. Marca resuelto_en / cerrado_en y lo deja en el historial.
 * Devuelve null si el ticket no existe.
 */
async function cambiarEstado(numero, nuevo, usuario, validar) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, estado, solucion FROM soporte.incidentes WHERE numero = $1 FOR UPDATE`,
      [numero]
    );
    const fila = rows[0];
    if (!fila) return null;
    validar({ actual: fila.estado, tieneSolucion: Boolean(fila.solucion) });

    const { rows: actualizado } = await client.query(
      `UPDATE soporte.incidentes
          SET estado = $2::varchar,
              actualizado_en = now(),
              resuelto_en = CASE WHEN $2::varchar = 'Resuelto' THEN now()
                                 WHEN $2::varchar IN ('En proceso','Pendiente','Abierto') THEN NULL
                                 ELSE resuelto_en END,
              cerrado_en  = CASE WHEN $2::varchar = 'Cerrado' THEN now() ELSE cerrado_en END
        WHERE id = $1
        RETURNING ${COLUMNAS_DETALLE}`,
      [fila.id, nuevo]
    );
    await client.query(
      `INSERT INTO soporte.incidentes_historial (incidente_id, campo, valor_anterior, valor_nuevo, usuario)
       VALUES ($1, 'estado', $2, $3, $4)`,
      [fila.id, fila.estado, nuevo, usuario]
    );
    return formatear(actualizado[0]);
  });
}

/** TDSI-693: historial del ticket, del más antiguo al más nuevo. null si el ticket no existe. */
async function historial(numero, { soloEstado = true } = {}) {
  const { rows: ticket } = await query(`SELECT id FROM soporte.incidentes WHERE numero = $1`, [numero]);
  if (!ticket[0]) return null;
  const { rows } = await query(
    `SELECT id, campo, valor_anterior, valor_nuevo, usuario, cambiado_en
       FROM soporte.incidentes_historial
      WHERE incidente_id = $1 AND ($2::boolean = false OR campo = 'estado')
      ORDER BY cambiado_en, id`,
    [ticket[0].id, soloEstado]
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

/**
 * TDSI-205: guarda la solución (con quién y cuándo) y deja el ticket en Resuelto, en una
 * sola transacción con su línea de historial. validar({ actual }) lanza si no se permite.
 * Devuelve null si el ticket no existe.
 */
async function registrarSolucion(numero, { solucion, usuario }, validar) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, estado FROM soporte.incidentes WHERE numero = $1 FOR UPDATE`,
      [numero]
    );
    const fila = rows[0];
    if (!fila) return null;
    validar({ actual: fila.estado });

    const { rows: actualizado } = await client.query(
      `UPDATE soporte.incidentes
          SET solucion = $2, solucion_registrada_por = $3, estado = 'Resuelto',
              resuelto_en = now(), actualizado_en = now()
        WHERE id = $1
        RETURNING ${COLUMNAS_DETALLE}`,
      [fila.id, solucion, usuario]
    );
    await client.query(
      `INSERT INTO soporte.incidentes_historial (incidente_id, campo, valor_anterior, valor_nuevo, usuario)
       VALUES ($1, 'estado', $2, 'Resuelto', $3)`,
      [fila.id, fila.estado, usuario]
    );
    return formatear(actualizado[0]);
  });
}

/** TDSI-968: comentarios del ticket, del más antiguo al más nuevo. null si el ticket no existe. */
async function listarComentarios(numero) {
  const { rows: ticket } = await query(`SELECT id FROM soporte.incidentes WHERE numero = $1`, [numero]);
  if (!ticket[0]) return null;
  const { rows } = await query(
    `SELECT id, autor, texto, creado_en FROM soporte.incidentes_comentarios
      WHERE incidente_id = $1 ORDER BY creado_en, id`,
    [ticket[0].id]
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

/** TDSI-968: agrega un comentario. null si el ticket no existe. */
async function agregarComentario(numero, { autor, texto }) {
  const { rows } = await query(
    `INSERT INTO soporte.incidentes_comentarios (incidente_id, autor, texto)
     SELECT id, $2, $3 FROM soporte.incidentes WHERE numero = $1
     RETURNING id, autor, texto, creado_en`,
    [numero, autor, texto]
  );
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

module.exports = {
  obtener,
  cambiarCampo,
  cambiarEstado,
  registrarSolucion,
  historial,
  listarComentarios,
  agregarComentario,
  COLUMNAS_DETALLE,
};
