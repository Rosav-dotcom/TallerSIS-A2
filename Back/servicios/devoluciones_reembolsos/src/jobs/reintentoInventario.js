const repo = require("../data/notificacionesInventarioRepo");
const { intentarEnvio } = require("../services/inventarioService");
const cfg = require("../config/inventario");

let enCurso = false;

/**
 * TDSI-77/1039: reintenta los avisos a Inventario que quedaron PENDIENTES (Pub/Sub no respondio,
 * o el servicio se cayo justo despues de procesar). Hasta INVENTARIO_MAX_INTENTOS (5) intentos
 * con espera creciente; despues el aviso queda en ERROR y se puede "Reenviar" (TDSI-1041).
 */
async function procesarPendientes() {
  if (enCurso) return [];
  enCurso = true;
  const resultados = [];
  try {
    for (const notificacion of await repo.tomarPendientes(10)) {
      const r = await intentarEnvio(notificacion);
      resultados.push(r);
      if (r.estado !== "ENVIADO") {
        console.warn(`[inventario] Aviso ${r.codigo} intento ${r.intentos} -> ${r.estado}: ${r.ultimo_error}`);
      }
    }
  } catch (e) {
    console.error("[inventario] Error procesando avisos pendientes:", e.message);
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  if (!cfg.PUBSUB_TOPIC) {
    console.log("[inventario] INVENTARIO_PUBSUB_TOPIC vacio: los avisos a Inventario quedan Pendientes");
    return;
  }
  const timer = setInterval(procesarPendientes, cfg.INTERVALO_WORKER_SEG * 1000);
  timer.unref();
  console.log(`[inventario] Avisos -> Pub/Sub (${cfg.PUBSUB_TOPIC}), reintentos cada ${cfg.INTERVALO_WORKER_SEG} s`);
}

module.exports = { iniciar, procesarPendientes };
