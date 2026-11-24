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

module.exports = { TRANSICIONES, validarTransicion };
