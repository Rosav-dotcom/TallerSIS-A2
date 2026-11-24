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

module.exports = { obtener, cambiarCampo, COLUMNAS_DETALLE };
