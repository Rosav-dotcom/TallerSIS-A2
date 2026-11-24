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

// Orden de la bandeja (TDSI-671): Critica, Alta, Media, Baja y, dentro de cada una, el más nuevo primero
const ORDEN_BANDEJA = `CASE prioridad WHEN 'Critica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Media' THEN 3 ELSE 4 END,
  creado_en DESC, id DESC`;

/**
 * TDSI-671: una página de la bandeja y el total de tickets que cumplen las condiciones.
 * condiciones/params: fragmentos SQL con $1, $2... ya numerados (los arma el servicio).
 */
async function listar({ condiciones = [], params = [], limite, offset }) {
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const n = params.length;
  const { rows } = await query(
    `SELECT ${COLUMNAS}, COUNT(*) OVER() AS total
       FROM soporte.incidentes
       ${where}
      ORDER BY ${ORDEN_BANDEJA}
      LIMIT $${n + 1} OFFSET $${n + 2}`,
    [...params, limite, offset]
  );
  if (rows.length > 0) {
    const total = Number(rows[0].total);
    const filas = rows.map((fila) => {
      const copia = { ...fila };
      delete copia.total;
      return formatear(copia);
    });
    return { total, filas };
  }
  // Página vacía: igual hace falta el total (p. ej. si se pidió una página que ya no existe)
  const { rows: conteo } = await query(`SELECT COUNT(*)::int AS total FROM soporte.incidentes ${where}`, params);
  return { total: conteo[0].total, filas: [] };
}

module.exports = { crear, listar, formatear, COLUMNAS };
