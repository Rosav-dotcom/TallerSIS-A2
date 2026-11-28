// TDSI-693: reglas de transición del estado de un ticket (función pura, sin base de datos).
//
//   Abierto     -> En proceso, Pendiente, Resuelto*
//   En proceso  -> Pendiente, Resuelto*
//   Pendiente   -> En proceso, Resuelto*
//   Escalado    -> En proceso            (vuelve del Administrador, TDSI-65)
//   Resuelto    -> Cerrado, En proceso   (cerrar o reabrir)
//   Cerrado     -> (ninguno: es el estado final)
//
// * Resuelto exige que el ticket ya tenga la solución aplicada (TDSI-205, PA TDSI-978).
// Escalado no se elige a mano: lo pone el escalamiento al Administrador (TDSI-65).

const TRANSICIONES = {
  Abierto: ["En proceso", "Pendiente", "Resuelto"],
  "En proceso": ["Pendiente", "Resuelto"],
  Pendiente: ["En proceso", "Resuelto"],
  Escalado: ["En proceso"],
  Resuelto: ["Cerrado", "En proceso"],
  Cerrado: [],
};

/**
 * Valida el cambio de estado. Devuelve null si se permite, o el motivo si no:
 *   { status, mensaje, permitidos }
 */
function validarTransicion({ actual, nuevo, tieneSolucion }) {
  const permitidos = TRANSICIONES[actual] || [];
  if (nuevo === actual) {
    return { status: 409, mensaje: `El ticket ya está en ${actual}.`, permitidos };
  }
  if (nuevo === "Escalado") {
    return { status: 409, mensaje: "Para escalar un ticket use el escalamiento al Administrador.", permitidos };
  }
  if (!permitidos.includes(nuevo)) {
    const opciones = permitidos.length ? `Desde ${actual} se puede pasar a: ${permitidos.join(", ")}.` : `${actual} es el estado final.`;
    return { status: 409, mensaje: `No se puede pasar de ${actual} a ${nuevo}. ${opciones}`, permitidos };
  }
  if (nuevo === "Resuelto" && !tieneSolucion) {
    return { status: 409, mensaje: "Para marcarlo como Resuelto primero registre la solución aplicada.", permitidos };
  }
  return null;
}

// TDSI-207 (TDSI-65): se escala lo que todavía se está atendiendo. Un ticket Resuelto o
// Cerrado ya no se escala, y uno Escalado no se vuelve a escalar.
const ESCALABLES = ["Abierto", "En proceso", "Pendiente"];

/** Devuelve null si el ticket se puede escalar, o { status, mensaje } si no. */
function validarEscalamiento(actual) {
  if (actual === "Escalado") {
    return { status: 409, mensaje: "El incidente ya está escalado al Administrador." };
  }
  if (!ESCALABLES.includes(actual)) {
    return { status: 409, mensaje: `Un incidente ${actual} no se puede escalar.` };
  }
  return null;
}

module.exports = { TRANSICIONES, ESCALABLES, validarTransicion, validarEscalamiento };
