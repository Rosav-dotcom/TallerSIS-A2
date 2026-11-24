const { query } = require("../config/db");

// Acceso a soporte.incidentes (TDSI-971). Un "ticket" es una fila de esta tabla.
const COLUMNAS = `id, numero, tipo, referencia_tipo, referencia, descripcion, estado, prioridad,
  usuario_afectado, registrado_por, creado_en, actualizado_en, resuelto_en, cerrado_en`;

const formatear = (fila) => (fila ? { ...fila, id: Number(fila.id) } : null);

/** TDSI-668: el número (INC-000001...) lo da la secuencia y el estado nace en 'Abierto'. */
async function crear({ tipo, prioridad, descripcion, usuario_afectado, referencia_tipo, referencia, registrado_por }) {
  const { rows } = await query(
    `INSERT INTO soporte.incidentes
       (tipo, prioridad, descripcion, usuario_afectado, referencia_tipo, referencia, registrado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNAS}`,
    [tipo, prioridad, descripcion, usuario_afectado, referencia_tipo, referencia, registrado_por]
  );
  return formatear(rows[0]);
}

module.exports = { crear, formatear, COLUMNAS };
