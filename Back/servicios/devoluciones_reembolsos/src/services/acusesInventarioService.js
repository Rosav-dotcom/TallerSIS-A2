const repo = require("../data/notificacionesInventarioRepo");

// TDSI-77/1040: acuse de Inventario (contrato en docs/contrato-inventario.md):
// { sistema_origen: "INVENTARIO", tipo_mensaje: "acuse_devolucion_stock",
//   referencia_externa: "DEV-000123", mensaje_id: "DEV-000123-1", estado: "confirmado"|"rechazado", motivo }
const REFERENCIA = /^DEV-\d{6,}$/;
const MENSAJE_ID = /^(DEV-\d{6,})-(\d{1,6})$/;
const ESTADOS = { confirmado: "CONFIRMADO", rechazado: "RECHAZADO" };
const SIN_MOTIVO = "Inventario rechazó el aviso sin indicar el motivo.";

/** Devuelve null si el mensaje no es un acuse de Inventario a un aviso de devolucion. */
function interpretar(texto) {
  let r;
  try {
    r = JSON.parse(texto);
  } catch {
    return null;
  }
  if (!r || r.sistema_origen !== "INVENTARIO" || r.tipo_mensaje !== "acuse_devolucion_stock") return null;
  const codigo = String(r.referencia_externa || "").trim().toUpperCase();
  const estado = ESTADOS[String(r.estado || "").trim().toLowerCase()];
  if (!REFERENCIA.test(codigo) || !estado) return null;

  let version = null;
  if (r.mensaje_id !== undefined && r.mensaje_id !== null) {
    const m = MENSAJE_ID.exec(String(r.mensaje_id).trim().toUpperCase());
    if (!m || m[1] !== codigo) return null;
    version = Number(m[2]);
  }
  const motivo = r.motivo ? String(r.motivo).trim().slice(0, 400) : null;
  return { codigo, version, estado, motivo: estado === "RECHAZADO" ? motivo || SIN_MOTIVO : motivo };
}

/**
 * Guarda el acuse en el aviso de esa devolucion: CONFIRMADO o RECHAZADO (con el motivo).
 * propio = true si el aviso es de esta base (se confirma, ack); si no, se libera para quien mas
 * lea la suscripcion. Un acuse de una version anterior (antes de un "Reenviar") se ignora.
 */
async function procesarMensaje({ texto }) {
  const datos = interpretar(texto);
  if (!datos) return { propio: false };
  const actual = await repo.obtenerPorCodigo(datos.codigo);
  if (!actual) return { propio: false };
  if (datos.version !== null && datos.version !== actual.version) {
    return { propio: true, ignorado: "version anterior", codigo: datos.codigo, notificacion: actual };
  }
  const notificacion = await repo.registrarAcuse({ id: actual.id, estado: datos.estado, motivo: datos.motivo });
  return { propio: true, codigo: datos.codigo, estado: datos.estado, notificacion };
}

module.exports = { interpretar, procesarMensaje, SIN_MOTIVO };
