const { query, withTransaction } = require("../config/db");

// TDSI-73/223: notas de credito (facturacion.notas_credito) vinculadas a la factura original.
const COLUMNAS = `n.id, n.numero, n.factura_id, f.numero AS factura_numero, f.fecha AS factura_fecha,
                  f.total AS factura_total, f.cliente_nit, f.cliente_nombre, n.devolucion_codigo, n.motivo,
                  n.monto, n.estado, n.emitida_por, n.emitida_en`;

/**
 * Crea la nota con sus items en una transaccion. Igual que las facturas (F-NNNNNN), el numero
 * NC-NNNNNN es el ultimo + 1 bajo un advisory lock, asi dos notas a la vez no chocan.
 * "verificar(factura, emitido)" corre con la factura bloqueada (FOR UPDATE) y la suma de lo ya
 * emitido, para validar antes de insertar (el trigger trg_notas_credito_tope es el respaldo).
 */
async function crear({ facturaNumero, devolucionCodigo, motivo, monto, emitidaPor, items }, verificar) {
  return withTransaction(async (client) => {
    const { rows: facturas } = await client.query(
      "SELECT * FROM facturacion.facturas WHERE numero = $1 FOR UPDATE",
      [facturaNumero]
    );
    const factura = facturas[0] || null;
    const { rows: suma } = factura
      ? await client.query(
          `SELECT COALESCE(SUM(monto), 0) AS emitido FROM facturacion.notas_credito
            WHERE factura_id = $1 AND estado = 'EMITIDA'`,
          [factura.id]
        )
      : { rows: [{ emitido: 0 }] };
    if (verificar) await verificar(factura, Number(suma[0].emitido));

    await client.query("SELECT pg_advisory_xact_lock(hashtext('facturacion.notas_credito.numero'))");
    const { rows: ultimas } = await client.query(
      "SELECT numero FROM facturacion.notas_credito ORDER BY length(numero) DESC, numero DESC LIMIT 1"
    );
    const siguiente = ultimas[0] ? Number(ultimas[0].numero.split("-")[1]) + 1 : 1;
    const numero = `NC-${String(siguiente).padStart(6, "0")}`;

    const { rows } = await client.query(
      `INSERT INTO facturacion.notas_credito (numero, factura_id, devolucion_codigo, motivo, monto, emitida_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [numero, factura.id, devolucionCodigo || null, motivo, monto, emitidaPor]
    );
    for (const it of items) {
      await client.query(
        `INSERT INTO facturacion.nota_credito_items (nota_credito_id, descripcion, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [rows[0].id, it.descripcion, it.cantidad, it.precio_unitario, it.subtotal]
      );
    }
    return rows[0].id;
  });
}

async function items(notaId) {
  const { rows } = await query(
    `SELECT descripcion, cantidad, precio_unitario, subtotal
       FROM facturacion.nota_credito_items WHERE nota_credito_id = $1 ORDER BY id`,
    [notaId]
  );
  return rows;
}

/** Nota completa (con la factura original y sus items); null si no existe. */
async function obtener({ id = null, numero = null, devolucionCodigo = null }) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
       FROM facturacion.notas_credito n
       JOIN facturacion.facturas f ON f.id = n.factura_id
      WHERE ($1::bigint IS NULL OR n.id = $1)
        AND ($2::text IS NULL OR n.numero = $2)
        AND ($3::text IS NULL OR n.devolucion_codigo = $3)
      LIMIT 1`,
    [id, numero, devolucionCodigo]
  );
  if (!rows[0]) return null;
  return { ...rows[0], items: await items(rows[0].id) };
}

/** Notas de una factura, de la mas antigua a la mas nueva. */
async function listarPorFactura(facturaNumero) {
  const { rows } = await query(
    `SELECT ${COLUMNAS}
       FROM facturacion.notas_credito n
       JOIN facturacion.facturas f ON f.id = n.factura_id
      WHERE f.numero = $1
      ORDER BY n.id`,
    [facturaNumero]
  );
  return rows;
}

module.exports = { crear, obtener, listarPorFactura };
