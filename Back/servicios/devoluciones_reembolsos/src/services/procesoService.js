const { AppError } = require("../utils/AppError");
const { normalizarCodigo } = require("../utils/codigoDevolucion");
const devolucionesRepo = require("../data/devolucionesRepo");
const { obtenerDevolucion, NO_ENCONTRADA } = require("./devolucionesService");
const { armarMensaje, enviarSeguro } = require("./inventarioService");

const SIN_USUARIO = "Indique quién procesa la devolución (usuario): el usuario con que inició sesión.";
const PROCESABLES = ["PENDIENTE", "APROBADA"];

/**
 * POST /api/devoluciones/:codigo/procesar -- TDSI-77/231. Cuerpo: { usuario }.
 * Da por terminada la devolucion (PROCESADA) y avisa a Inventario para reingresar o dar de baja
 * los productos (mensaje devolucion_stock con la referencia DEV-<codigo>). Solo una devolucion
 * PENDIENTE o APROBADA: una RECHAZADA no avisa a Inventario (PA TDSI-1050) y una ya procesada no
 * se procesa dos veces.
 */
async function procesarDevolucion(codigo, body) {
  const usuario = typeof body?.usuario === "string" ? body.usuario.trim() : "";
  if (!usuario) throw new AppError(SIN_USUARIO, 400);
  if (usuario.length > 60) throw new AppError("El usuario admite hasta 60 caracteres.", 400);

  const normalizado = normalizarCodigo(codigo);
  const resultado = normalizado
    ? await devolucionesRepo.procesar(normalizado, {
        usuario,
        validar: (fila) => {
          if (fila.estado === "PROCESADA") {
            throw new AppError(`La devolución ${fila.codigo} ya fue procesada.`, 409, { estado: fila.estado });
          }
          if (!PROCESABLES.includes(fila.estado)) {
            throw new AppError(`Solo se procesa una devolución PENDIENTE o APROBADA (${fila.codigo} está ${fila.estado}).`, 409,
              { estado: fila.estado });
          }
        },
        armarPayload: (fila, items) => armarMensaje({ devolucion: fila, items }),
      })
    : null;
  if (!resultado) throw new AppError(NO_ENCONTRADA, 404, { codigo });

  // fuera de la transaccion: si Pub/Sub falla, el aviso queda Pendiente para el worker
  if (resultado.notificacionId) await enviarSeguro(resultado.notificacionId, resultado.payload);
  return obtenerDevolucion(resultado.devolucion.codigo);
}

module.exports = { procesarDevolucion, SIN_USUARIO };
