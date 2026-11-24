const { AppError } = require("../utils/AppError");
const { normalizarCodigo } = require("../utils/codigoDevolucion");
const devolucionesRepo = require("../data/devolucionesRepo");
const facturacion = require("../clients/facturacionClient");
const { obtenerDevolucion, NO_ENCONTRADA } = require("./devolucionesService");

const SIN_USUARIO = "Indique quién emite la nota de crédito (usuario): el usuario con que inició sesión.";

/**
 * POST /api/devoluciones/:codigo/nota-credito -- TDSI-73/1016. Cuerpo: { usuario }.
 * Pide a Facturacion la nota de credito de la devolucion (factura original, items, monto y
 * motivo de la devolucion) y guarda solo su numero (un dato, un dueño).
 * - Una devolucion RECHAZADA no genera nota (409; TDSI-1050).
 * - Una devolucion tiene una sola nota: si ya la tiene, 409 con su numero. Si Facturacion ya la
 *   habia emitido (un intento anterior que no llego a guardarse aqui), se recupera esa misma.
 */
async function emitirNotaCreditoDeDevolucion(codigo, body) {
  const usuario = typeof body?.usuario === "string" ? body.usuario.trim() : "";
  if (!usuario) throw new AppError(SIN_USUARIO, 400);
  if (usuario.length > 100) throw new AppError("El usuario admite hasta 100 caracteres.", 400);

  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) throw new AppError(NO_ENCONTRADA, 404, { codigo });
  const detalle = await obtenerDevolucion(normalizado); // 404 si no existe

  const resultado = await devolucionesRepo.registrarNotaCredito(normalizado, async (fila, numeroExistente) => {
    if (fila.estado === "RECHAZADA") {
      throw new AppError("La devolución está RECHAZADA: no genera nota de crédito.", 409, { codigo: fila.codigo });
    }
    if (numeroExistente) {
      throw new AppError(`La devolución ${fila.codigo} ya tiene la nota de crédito ${numeroExistente}.`, 409,
        { numero: numeroExistente });
    }
    const motivo = [`Devolución ${fila.codigo}`, detalle.motivo?.nombre, detalle.observaciones].filter(Boolean).join(" · ");
    try {
      return await facturacion.emitirNotaCredito({
        factura_numero: fila.factura_numero,
        devolucion_codigo: fila.codigo,
        monto: Number(fila.monto_total),
        motivo: [...motivo].slice(0, 300).join(""),
        emitida_por: usuario,
        items: detalle.items.map((it) => ({
          descripcion: it.descripcion, cantidad: it.cantidad, precio_unitario: it.precio_unitario,
        })),
      });
    } catch (e) {
      // ya emitida en Facturacion en un intento anterior: se toma esa
      if (e.status === 409 && e.detalle?.numero) {
        const existente = await facturacion.obtenerNotaCredito(e.detalle.numero);
        if (existente && existente.devolucion_codigo === fila.codigo) return existente;
      }
      throw e;
    }
  });
  return resultado.nota;
}

module.exports = { emitirNotaCreditoDeDevolucion, SIN_USUARIO };
