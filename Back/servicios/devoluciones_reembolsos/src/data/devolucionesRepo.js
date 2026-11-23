const { pool } = require("../config/db");

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

module.exports = { crear };
