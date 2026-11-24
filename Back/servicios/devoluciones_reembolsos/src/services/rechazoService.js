const { AppError } = require("../utils/AppError");
const { normalizarCodigo } = require("../utils/codigoDevolucion");
const devolucionesRepo = require("../data/devolucionesRepo");
const { obtenerDevolucion, NO_ENCONTRADA } = require("./devolucionesService");

// TDSI-78: rechazar una solicitud de devolucion no procedente indicando el motivo.
const SIN_MOTIVO = "Indique el motivo del rechazo.";
const SIN_USUARIO = "Indique quién rechaza la devolución (usuario): el usuario con que inició sesión.";
const MAX_MOTIVO = 300;
const RECHAZABLES = ["PENDIENTE", "APROBADA"];

function validarPedido(body) {
  const datos = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";
  if (!motivo) throw new AppError(SIN_MOTIVO, 400); // PA TDSI-1048
  const largo = [...motivo].length;
  if (largo > MAX_MOTIVO) {
    throw new AppError(`El motivo del rechazo no puede tener más de ${MAX_MOTIVO} caracteres.`, 400, { largo });
  }
  const usuario = typeof datos.usuario === "string" ? datos.usuario.trim() : "";
  if (!usuario) throw new AppError(SIN_USUARIO, 400);
  if (usuario.length > 60) throw new AppError("El usuario admite hasta 60 caracteres.", 400);
  return { motivo, usuario };
}

/** Dentro de la transaccion, con la devolucion bloqueada: se puede rechazar? */
async function verificarRechazable(devolucion) {
  if (!RECHAZABLES.includes(devolucion.estado)) {
    throw new AppError(
      `Solo se puede rechazar una devolución PENDIENTE o APROBADA (${devolucion.codigo} está ${devolucion.estado}).`,
      409,
      { codigo: devolucion.codigo, estado: devolucion.estado }
    );
  }
}

/**
 * POST /api/devoluciones/:codigo/rechazo -- TDSI-78/233. Cuerpo: { motivo, usuario }.
 * Cambia el estado a RECHAZADA y guarda el motivo; el historial lo registra la BD (TDSI-81).
 */
async function rechazarDevolucion(codigo, body) {
  const { motivo, usuario } = validarPedido(body);
  const normalizado = normalizarCodigo(codigo);
  const fila = normalizado
    ? await devolucionesRepo.cambiarEstado(normalizado, "RECHAZADA", {
        usuario, extra: { motivo_rechazo: motivo }, validar: verificarRechazable,
      })
    : null;
  if (!fila) throw new AppError(NO_ENCONTRADA, 404, { codigo });
  return obtenerDevolucion(fila.codigo);
}

module.exports = { rechazarDevolucion, verificarRechazable, SIN_MOTIVO, SIN_USUARIO, MAX_MOTIVO };
