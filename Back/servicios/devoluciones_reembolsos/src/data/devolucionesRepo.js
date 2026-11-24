const { pool, query } = require("../config/db");
const notificacionesInventarioRepo = require("./notificacionesInventarioRepo");

// Columnas que el registro puede mandar. "codigo" NO esta: lo pone la BD (TDSI-76).
const COLUMNAS_CABECERA = [
  "factura_numero", "venta_id", "cliente_nit", "fecha_venta", "dentro_de_plazo", "tipo", "motivo_id",
  "observaciones", "metodo_pago_original", "monto_total", "estado", "requiere_autorizacion",
  "autorizado_por", "autorizado_en", "creado_por", "opcion_reembolso", "autorizado_por_nombre", "caja_id",
];

const COLUMNAS_ITEM = "factura_item_id, codigo_producto, descripcion, cantidad, precio_unitario, subtotal, condicion";

/** Inserta la cabecera (el trigger le pone el codigo DEV-) y sus items con la conexion dada. */
async function insertar(cliente, datos, items) {
  const columnas = COLUMNAS_CABECERA.filter((c) => datos[c] !== undefined);
  const valores = columnas.map((c) => datos[c]);
  const marcadores = columnas.map((_, i) => `$${i + 1}`);
  const { rows } = await cliente.query(
    `INSERT INTO devoluciones.devoluciones (${columnas.join(", ")}) VALUES (${marcadores.join(", ")}) RETURNING *`,
    valores
  );
  const devolucion = rows[0];
  const guardados = [];
  for (const it of items) {
    const r = await cliente.query(
      `INSERT INTO devoluciones.devolucion_items (devolucion_id, ${COLUMNAS_ITEM})
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLUMNAS_ITEM}`,
      [devolucion.id, it.factura_item_id ?? null, it.codigo_producto ?? null, it.descripcion, it.cantidad,
        it.precio_unitario, it.subtotal, it.condicion ?? "REINGRESO"]
    );
    guardados.push(r.rows[0]);
  }
  return { ...devolucion, items: guardados };
}

async function enTransaccion(trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await trabajo(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

/**
 * TDSI-76/229: guarda la devolucion y sus items en una sola transaccion y devuelve la fila
 * con el codigo DEV-NNNNNN que le asigno la BD. Aunque "datos" traiga un codigo se ignora
 * (lo pone el trigger), y si algo falla el ROLLBACK tambien deshace el correlativo, asi no
 * quedan huecos.
 */
async function crear(datos, items = []) {
  return enTransaccion((cliente) => insertar(cliente, datos, items));
}

/**
 * TDSI-70/1001: registra una devolucion de la factura "facturaNumero" sin pasarse de lo
 * comprado. Dentro de la transaccion: bloquea esa factura (dos registros a la vez de la misma
 * factura esperan su turno), lee lo ya devuelto de cada item (sin contar las RECHAZADAS) y
 * llama a construir(yaDevuelto) -- Map factura_item_id -> cantidad -- que valida y devuelve
 * { datos, items } o lanza el error. Asi nadie puede devolver dos veces la misma unidad.
 */
async function registrar(facturaNumero, construir) {
  return enTransaccion(async (cliente) => {
    await cliente.query("SELECT pg_advisory_xact_lock(hashtextextended('devolucion:' || $1, 0))", [facturaNumero]);
    const { rows } = await cliente.query(
      `SELECT i.factura_item_id, SUM(i.cantidad) AS cantidad
         FROM devoluciones.devolucion_items i
         JOIN devoluciones.devoluciones d ON d.id = i.devolucion_id
        WHERE d.factura_numero = $1 AND d.estado <> 'RECHAZADA' AND i.factura_item_id IS NOT NULL
        GROUP BY i.factura_item_id`,
      [facturaNumero]
    );
    const yaDevuelto = new Map(rows.map((r) => [Number(r.factura_item_id), Number(r.cantidad)]));
    const { datos, items } = await construir(yaDevuelto);
    return insertar(cliente, datos, items);
  });
}

const RESUMEN = "d.codigo, d.factura_numero, d.cliente_nit, d.fecha_solicitud, d.tipo, d.estado, d.monto_total, m.nombre AS motivo_nombre, d.motivo_rechazo, ni.estado AS inv_estado";

/** TDSI-76/1112: la devolucion con ese codigo exacto (ya normalizado) y sus items; null si no existe. */
async function buscarPorCodigo(codigo) {
  const { rows } = await query(
    `SELECT d.*, m.nombre AS motivo_nombre, r.cambiado_por AS rechazado_por, r.cambiado_en AS rechazado_en,
            nc.numero AS nota_credito_numero, nc.monto AS nota_credito_monto, nc.estado AS nota_credito_estado,
            nc.emitida_en AS nota_credito_emitida_en,
            ni.estado AS inv_estado, ni.intentos AS inv_intentos, ni.version AS inv_version,
            ni.ultimo_error AS inv_ultimo_error, ni.resultado_motivo AS inv_resultado_motivo,
            ni.enviado_en AS inv_enviado_en, ni.resultado_en AS inv_resultado_en
       FROM devoluciones.devoluciones d
       LEFT JOIN devoluciones.motivos m ON m.id = d.motivo_id
       -- TDSI-78/1117: quien y cuando la rechazo, del historial (el ultimo rechazo)
       LEFT JOIN LATERAL (
         SELECT h.cambiado_por, h.cambiado_en FROM devoluciones.historial_estados h
          WHERE h.devolucion_id = d.id AND h.estado_nuevo = 'RECHAZADA'
          ORDER BY h.cambiado_en DESC, h.id DESC LIMIT 1
       ) r ON d.estado = 'RECHAZADA'
       -- TDSI-73/1016: referencia a la nota de credito de Facturacion (la ultima emitida)
       LEFT JOIN LATERAL (
         SELECT n.numero, n.monto, n.estado, n.emitida_en FROM devoluciones.notas_credito n
          WHERE n.devolucion_id = d.id ORDER BY (n.estado = 'EMITIDA') DESC, n.id DESC LIMIT 1
       ) nc ON true
       -- TDSI-77/231: aviso a Inventario (uno por devolucion)
       LEFT JOIN devoluciones.notificaciones_inventario ni ON ni.devolucion_id = d.id
      WHERE d.codigo = $1`,
    [codigo]
  );
  if (!rows[0]) return null;
  const items = await query(
    `SELECT ${COLUMNAS_ITEM} FROM devoluciones.devolucion_items WHERE devolucion_id = $1 ORDER BY id`,
    [rows[0].id]
  );
  return { ...rows[0], items: items.rows };
}

/**
 * TDSI-76/1112: filas de la lista; con codigo, solo esa (0 o 1). Las mas nuevas primero.
 * TDSI-70: filtros de la lista "Devoluciones" por estado y por fecha de registro (instantes).
 */
async function listar({ codigo = null, estado = null, desde = null, hasta = null, limite = 100 } = {}) {
  const { rows } = await query(
    `SELECT ${RESUMEN}
       FROM devoluciones.devoluciones d
       LEFT JOIN devoluciones.motivos m ON m.id = d.motivo_id
       LEFT JOIN devoluciones.notificaciones_inventario ni ON ni.devolucion_id = d.id
      WHERE ($1::TEXT IS NULL OR d.codigo = $1)
        AND ($3::TEXT IS NULL OR d.estado = $3)
        AND ($4::TIMESTAMPTZ IS NULL OR d.fecha_solicitud >= $4)
        AND ($5::TIMESTAMPTZ IS NULL OR d.fecha_solicitud <= $5)
      ORDER BY length(d.codigo) DESC, d.codigo DESC LIMIT $2`, // orden del correlativo, no del id (DEV-1000000 despues de DEV-999999)
    [codigo, limite, estado, desde, hasta]
  );
  return rows;
}

/**
 * TDSI-81/1057: cambia el estado de una devolucion dejando quien y por que en el historial.
 * El trigger trg_devoluciones_historial escribe el historial; aqui se le pasa el usuario y el
 * comentario con set_config(..., true), que dura solo esta transaccion. "extra" son otras
 * columnas a cambiar junto con el estado (p. ej. motivo_rechazo). Devuelve la fila o null.
 * TDSI-78/233: la fila se bloquea (FOR UPDATE) y "validar(fila, cliente)" decide, dentro de la
 * misma transaccion, si el cambio se puede hacer (lanza el error si no). Asi dos acciones a la
 * vez sobre la misma devolucion no se pisan.
 */
const COLUMNAS_ESTADO = ["motivo_rechazo", "autorizado_por", "autorizado_en", "requiere_autorizacion"];
async function cambiarEstado(codigo, estado, { usuario, comentario = null, extra = {}, validar = null } = {}) {
  return enTransaccion(async (cliente) => {
    const actual = await cliente.query("SELECT * FROM devoluciones.devoluciones WHERE codigo = $1 FOR UPDATE", [codigo]);
    if (!actual.rows[0]) return null;
    if (validar) await validar(actual.rows[0], cliente);
    await cliente.query(
      "SELECT set_config('devoluciones.usuario', $1, true), set_config('devoluciones.comentario', $2, true)",
      [usuario || "", comentario || ""]
    );
    const columnas = COLUMNAS_ESTADO.filter((c) => extra[c] !== undefined);
    const sets = ["estado = $2", ...columnas.map((c, i) => `${c} = $${i + 3}`)];
    const { rows } = await cliente.query(
      `UPDATE devoluciones.devoluciones SET ${sets.join(", ")} WHERE codigo = $1 RETURNING *`,
      [codigo, estado, ...columnas.map((c) => extra[c])]
    );
    return rows[0] || null;
  });
}

/**
 * TDSI-80/1069: devoluciones registradas entre dos instantes (un dia de Bolivia), sin las
 * RECHAZADAS (no reintegran dinero), para el resumen por caja de gestion_caja.
 */
async function delPeriodo(desde, hasta) {
  const { rows } = await query(
    `SELECT codigo, caja_id, fecha_solicitud, estado, monto_total, opcion_reembolso,
            autorizado_por, autorizado_por_nombre, creado_por
       FROM devoluciones.devoluciones
      WHERE fecha_solicitud >= $1 AND fecha_solicitud <= $2 AND estado <> 'RECHAZADA'
      ORDER BY caja_id NULLS LAST, length(codigo), codigo`,
    [desde, hasta]
  );
  return rows;
}

/**
 * TDSI-73/1016: guarda la referencia a la nota de credito que emitio Facturacion. Con la
 * devolucion bloqueada (FOR UPDATE): "emitir(fila)" valida y pide la nota a Facturacion, y su
 * numero se guarda en devoluciones.notas_credito en la misma transaccion. Asi un rechazo a la vez
 * espera, y el trigger de TDSI-1116 impide la referencia si la devolucion esta RECHAZADA.
 * Devuelve { devolucion, nota } o null si la devolucion no existe.
 */
async function registrarNotaCredito(codigo, emitir) {
  return enTransaccion(async (cliente) => {
    const { rows } = await cliente.query("SELECT * FROM devoluciones.devoluciones WHERE codigo = $1 FOR UPDATE", [codigo]);
    if (!rows[0]) return null;
    const existentes = await cliente.query(
      "SELECT numero FROM devoluciones.notas_credito WHERE devolucion_id = $1 AND estado = 'EMITIDA'",
      [rows[0].id]
    );
    const nota = await emitir(rows[0], existentes.rows[0]?.numero || null);
    await cliente.query(
      `INSERT INTO devoluciones.notas_credito (devolucion_id, numero, monto, estado, emitida_en)
       VALUES ($1, $2, $3, 'EMITIDA', $4)
       ON CONFLICT (numero) DO NOTHING`,
      [rows[0].id, nota.numero, nota.monto, nota.emitida_en]
    );
    return { devolucion: rows[0], nota };
  });
}

/**
 * TDSI-77/231: procesa la devolucion (-> PROCESADA) y guarda su aviso a Inventario en la MISMA
 * transaccion (outbox): si despues Pub/Sub falla, el aviso no se pierde. Con la devolucion
 * bloqueada: validar(fila) decide si se puede procesar y armarPayload(fila, items) arma el
 * mensaje. El historial lo escribe la BD (TDSI-81). Devuelve { devolucion, notificacionId } o
 * null si no existe.
 */
async function procesar(codigo, { usuario, validar, armarPayload }) {
  return enTransaccion(async (cliente) => {
    const actual = await cliente.query("SELECT * FROM devoluciones.devoluciones WHERE codigo = $1 FOR UPDATE", [codigo]);
    if (!actual.rows[0]) return null;
    await validar(actual.rows[0]);
    const items = await cliente.query(
      `SELECT ${COLUMNAS_ITEM} FROM devoluciones.devolucion_items WHERE devolucion_id = $1 ORDER BY id`,
      [actual.rows[0].id]
    );
    await cliente.query(
      "SELECT set_config('devoluciones.usuario', $1, true), set_config('devoluciones.comentario', $2, true)",
      [usuario, "Devolución procesada · aviso a Inventario"]
    );
    const { rows } = await cliente.query(
      "UPDATE devoluciones.devoluciones SET estado = 'PROCESADA' WHERE id = $1 RETURNING *",
      [actual.rows[0].id]
    );
    const payload = armarPayload(rows[0], items.rows);
    const notificacionId = await notificacionesInventarioRepo.crearEnTransaccion(cliente, { devolucionId: rows[0].id, payload });
    return { devolucion: rows[0], notificacionId, payload };
  });
}

module.exports = { crear, registrar, buscarPorCodigo, listar, cambiarEstado, delPeriodo, registrarNotaCredito, procesar };
