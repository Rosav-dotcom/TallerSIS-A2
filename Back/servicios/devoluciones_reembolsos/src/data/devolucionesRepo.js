const { pool, query } = require("../config/db");

// Columnas que el registro puede mandar. "codigo" NO esta: lo pone la BD (TDSI-76).
const COLUMNAS_CABECERA = [
  "factura_numero", "venta_id", "cliente_nit", "fecha_venta", "dentro_de_plazo", "tipo", "motivo_id",
  "observaciones", "metodo_pago_original", "monto_total", "estado", "requiere_autorizacion",
  "autorizado_por", "autorizado_en", "creado_por",
];

/**
 * TDSI-76/229: guarda la devolucion y sus items en una sola transaccion y devuelve la fila
 * con el codigo DEV-NNNNNN que le asigno la BD. Aunque "datos" traiga un codigo se ignora
 * (lo pone el trigger), y si algo falla el ROLLBACK tambien deshace el correlativo, asi no
 * quedan huecos. Las validaciones del registro van en el servicio (TDSI-1001).
 */
async function crear(datos, items = []) {
  const columnas = COLUMNAS_CABECERA.filter((c) => datos[c] !== undefined);
  const valores = columnas.map((c) => datos[c]);
  const marcadores = columnas.map((_, i) => `$${i + 1}`);

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `INSERT INTO devoluciones.devoluciones (${columnas.join(", ")}) VALUES (${marcadores.join(", ")}) RETURNING *`,
      valores
    );
    const devolucion = rows[0];
    const guardados = [];
    for (const it of items) {
      const r = await cliente.query(
        `INSERT INTO devoluciones.devolucion_items (devolucion_id, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5) RETURNING descripcion, cantidad, precio_unitario, subtotal`,
        [devolucion.id, it.descripcion, it.cantidad, it.precio_unitario, it.subtotal]
      );
      guardados.push(r.rows[0]);
    }
    await cliente.query("COMMIT");
    return { ...devolucion, items: guardados };
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

const RESUMEN = "codigo, factura_numero, cliente_nit, fecha_solicitud, tipo, estado, monto_total";

/** TDSI-76/1112: la devolucion con ese codigo exacto (ya normalizado) y sus items; null si no existe. */
async function buscarPorCodigo(codigo) {
  const { rows } = await query("SELECT * FROM devoluciones.devoluciones WHERE codigo = $1", [codigo]);
  if (!rows[0]) return null;
  const items = await query(
    `SELECT descripcion, cantidad, precio_unitario, subtotal
       FROM devoluciones.devolucion_items WHERE devolucion_id = $1 ORDER BY id`,
    [rows[0].id]
  );
  return { ...rows[0], items: items.rows };
}

/** TDSI-76/1112: filas de la lista; con codigo, solo esa (0 o 1). Las mas nuevas primero. */
async function listar({ codigo = null, limite = 100 } = {}) {
  const { rows } = await query(
    `SELECT ${RESUMEN} FROM devoluciones.devoluciones
      WHERE ($1::TEXT IS NULL OR codigo = $1)
      ORDER BY length(codigo) DESC, codigo DESC LIMIT $2`, // orden del correlativo, no del id (DEV-1000000 despues de DEV-999999)
    [codigo, limite]
  );
  return rows;
}

module.exports = { crear, buscarPorCodigo, listar };
