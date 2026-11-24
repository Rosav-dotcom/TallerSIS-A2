const subscriber = require("../clients/pubsubSubscriber");
const { procesarMensaje } = require("../services/acusesInventarioService");
const cfg = require("../config/inventario");

let enCurso = false;
let ultimoError = null;

/**
 * TDSI-77/1040: lee la suscripcion del topico del Grupo A, guarda cada acuse de Inventario en el
 * aviso de su devolucion y lo confirma (ack). Lo demas se libera sin confirmar, para no
 * quitarselo a Facturacion o Gestion de pagos, que leen la misma suscripcion.
 */
async function procesarAcuses() {
  if (enCurso || !cfg.ACUSES_SUBSCRIPTION) return [];
  enCurso = true;
  const resultados = [];
  try {
    const suscripcion = subscriber.nombreSuscripcion(cfg.ACUSES_SUBSCRIPTION);
    const mensajes = await subscriber.leer(50, suscripcion);
    const confirmar = [];
    const liberar = [];
    for (const m of mensajes) {
      try {
        const r = await procesarMensaje(m);
        (r.propio ? confirmar : liberar).push(m.ackId);
        if (r.propio) {
          resultados.push(r);
          console.log(`[inventario] ${r.codigo} -> ${r.ignorado ? `ignorado (${r.ignorado})` : r.estado}`);
        }
      } catch (e) {
        liberar.push(m.ackId); // se vuelve a intentar en la siguiente lectura
        console.error(`[inventario] No se pudo guardar el acuse ${m.messageId}:`, e.message);
      }
    }
    await subscriber.confirmar(confirmar, suscripcion);
    await subscriber.liberar(liberar, suscripcion);
    ultimoError = null;
  } catch (e) {
    if (e.message !== ultimoError) console.error("[inventario] No se pudieron leer los acuses:", e.message);
    ultimoError = e.message;
  } finally {
    enCurso = false;
  }
  return resultados;
}

function iniciar() {
  if (!cfg.ACUSES_SUBSCRIPTION) return;
  let suscripcion;
  try {
    suscripcion = subscriber.nombreSuscripcion(cfg.ACUSES_SUBSCRIPTION);
  } catch (e) {
    console.error(`[inventario] No se leen los acuses: ${e.message}`); // configuracion invalida: el servicio sigue
    return;
  }
  const timer = setInterval(procesarAcuses, cfg.ACUSES_INTERVALO_SEG * 1000);
  timer.unref();
  console.log(`[inventario] Leyendo acuses de ${suscripcion} cada ${cfg.ACUSES_INTERVALO_SEG} s`);
}

module.exports = { iniciar, procesarAcuses };
