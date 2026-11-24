const repo = require("../data/notificacionesInventarioRepo");
const { publicar } = require("../clients/pubsubPublisher");
const cfg = require("../config/inventario");

// Sin topico el aviso espera (sin gastar intentos) a que se configure.
const SIN_TOPICO = "Inventario todavía no está configurado (INVENTARIO_PUBSUB_TOPIC): el aviso se enviará cuando se configure.";

// TDSI-77: aviso a Inventario (Modulo de Gestion de Inventarios y Almacen) por Pub/Sub.
const fechaBolivia = (v) => new Date(v).toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
const num = (v) => Math.round(Number(v || 0) * 100) / 100;

/** "DEV-000123" + version 1 -> "DEV-000123-1": la clave de idempotencia del aviso. */
const mensajeId = (codigo, version) => `${codigo}-${version}`;

/**
 * TDSI-77/231: mensaje "devolucion_stock" con la referencia DEV-<codigo>, los items, la cantidad y
 * la condicion: REINGRESO (vuelve al stock) o MERMA (se da de baja). Contrato en
 * docs/contrato-inventario.md.
 */
function armarMensaje({ devolucion, items, version = 1, fecha = new Date() }) {
  return {
    sistema_origen: "DEVOLUCIONES",
    tipo_mensaje: "devolucion_stock",
    referencia_externa: devolucion.codigo,
    mensaje_id: mensajeId(devolucion.codigo, version),
    fecha_documento: fechaBolivia(fecha),
    datos: {
      factura_numero: devolucion.factura_numero,
      tipo: devolucion.tipo,
      items: items.map((it) => ({
        codigo_producto: it.codigo_producto ?? null,
        descripcion: it.descripcion,
        cantidad: num(it.cantidad),
        condicion: it.condicion,
      })),
    },
  };
}

/**
 * Un intento de publicacion; deja registrado el resultado. TDSI-1039: si falla, reintento con
 * espera creciente hasta INVENTARIO_MAX_INTENTOS (5) y despues ERROR.
 */
async function intentarEnvio(notificacion) {
  if (!cfg.PUBSUB_TOPIC) return repo.posponer(notificacion.id, cfg.BACKOFF_BASE_SEG, SIN_TOPICO);
  const payload = notificacion.payload || (await repo.obtener(notificacion.id, { conPayload: true })).payload;
  const r = await publicar(payload, {
    tipo: "DEVOLUCION_STOCK",
    referencia_externa: payload.referencia_externa,
    idempotency_key: payload.mensaje_id,
    origen: "devoluciones",
    grupo: "A",
  });
  if (r.ok) return repo.marcarEnviado(notificacion.id, r.messageId);
  return repo.registrarFallo(notificacion.id, r, cfg.MAX_INTENTOS, cfg.BACKOFF_BASE_SEG);
}

/**
 * Despues de procesar: nunca hace fallar la operacion; si falla, el aviso queda Pendiente.
 * El primer intento publica el mensaje tal como se armo (JSONB reordena las claves al guardarlo).
 */
async function enviarSeguro(notificacionId, payload = null) {
  try {
    const notificacion = await repo.obtener(notificacionId, { conPayload: !payload });
    return await intentarEnvio(payload ? { ...notificacion, payload } : notificacion);
  } catch (e) {
    console.error(`[inventario] No se pudo enviar el aviso ${notificacionId}:`, e.message);
    return repo.obtener(notificacionId);
  }
}

/**
 * Estado para la columna "Inventario" y la tarjeta "Aviso a Inventario" (chip Pendiente /
 * Enviado / Confirmado / Rechazado / Error). null si la devolucion todavia no se proceso.
 */
function estadoInventario(n) {
  if (!n) return null;
  const textos = { PENDIENTE: "Pendiente", ENVIADO: "Enviado", CONFIRMADO: "Confirmado", RECHAZADO: "Rechazado", ERROR: "Error" };
  return {
    estado: n.estado,
    texto: textos[n.estado] || n.estado,
    intentos: n.intentos,
    version: n.version,
    ultimo_error: n.ultimo_error ?? null,
    motivo_rechazo: n.estado === "RECHAZADO" ? n.resultado_motivo ?? null : null,
    enviado_en: n.enviado_en ?? null,
    resultado_en: n.resultado_en ?? null,
  };
}

module.exports = { armarMensaje, mensajeId, intentarEnvio, enviarSeguro, estadoInventario, SIN_TOPICO };
