const { evaluarPlazo } = require("../utils/diasHabiles");
const { obtenerPlazoDias } = require("./configuracionService");

// TDSI-69: textos de la alerta del paso 1 de "Nueva devolucion" (guia devoluciones-nueva.md).
const AVISO_DENTRO = "Todo en orden";
const AVISO_FUERA = "Revisión pendiente";

const ddmmaaaa = (dia) => dia.split("-").reverse().join("/");

/**
 * TDSI-69/1098: plazo de un comprobante -- dias habiles desde su emision (sin sabados ni
 * domingos), fecha limite y si todavia se puede devolver. Fuera de plazo NO es un error:
 * se responde igual, con dentro_de_plazo=false, y la pantalla deshabilita "Continuar".
 * "plazoDias" se puede pasar ya leido (para no consultar la configuracion por cada compra).
 */
async function plazoDeComprobante(fechaEmision, { plazoDias, hoy = new Date() } = {}) {
  const plazo = plazoDias ?? (await obtenerPlazoDias()).plazo_dias;
  const r = evaluarPlazo({ fechaEmision, plazoDias: plazo, hoy });
  const n = r.dias_transcurridos;
  return {
    ...r,
    aviso: r.dentro_de_plazo ? AVISO_DENTRO : AVISO_FUERA,
    // "Emitido hace N dias habiles · Limite: dd/mm/aaaa" de la tarjeta del comprobante
    mensaje: `Emitido hace ${n} ${n === 1 ? "día hábil" : "días hábiles"} · Límite: ${ddmmaaaa(r.fecha_limite)}`,
  };
}

module.exports = { plazoDeComprobante, AVISO_DENTRO, AVISO_FUERA };
