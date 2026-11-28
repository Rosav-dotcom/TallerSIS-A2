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

const HISTORIAL_MAX = 200;

/**
 * TDSI-209: incidentes de un usuario afectado (mismo correo o nombre, sin distinguir
 * mayúsculas), del más reciente al más antiguo, con su solución.
 */
async function historialPorUsuario(usuario) {
  const { rows } = await query(
    `SELECT numero, creado_en AS fecha, tipo, prioridad, estado, descripcion,
            referencia_tipo, referencia, solucion, solucion_registrada_por,
            resuelto_en, cerrado_en, registrado_por,
            COUNT(*) OVER() AS total
       FROM soporte.incidentes
      WHERE lower(usuario_afectado) = lower($1)
      ORDER BY creado_en DESC, id DESC
      LIMIT ${HISTORIAL_MAX}`,
    [usuario]
  );
  const total = rows.length ? Number(rows[0].total) : 0;
  const filas = rows.map((fila) => {
    const copia = { ...fila };
    delete copia.total;
    return copia;
  });
  return { total, filas };
}

/** TDSI-209: usuarios con incidentes (para elegir a quién ver), opcionalmente filtrados por texto. */
async function usuariosConIncidentes(patron = null) {
  const { rows } = await query(
    `SELECT MIN(usuario_afectado) AS usuario, COUNT(*)::int AS cantidad, MAX(creado_en) AS ultimo_en
       FROM soporte.incidentes
      WHERE usuario_afectado IS NOT NULL
        AND ($1::text IS NULL OR usuario_afectado ILIKE $1)
      GROUP BY lower(usuario_afectado)
      ORDER BY MAX(creado_en) DESC
      LIMIT 50`,
    [patron]
  );
  return rows;
}

module.exports = { crear, listar, historialPorUsuario, usuariosConIncidentes, formatear, COLUMNAS, HISTORIAL_MAX };
