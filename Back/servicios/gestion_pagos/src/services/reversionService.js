const { AppError } = require("../utils/AppError");
const repo = require("../data/reversionesRepo");
const { crearPasarelaSimulada } = require("./pasarelaSimulada");
const { emitirActualizacion } = require("../utils/tableroEvents");

// TDSI-1026 (TDSI-74): reversión de un pago con tarjeta por una devolución.
// Sigue el mismo flujo que la anulación de ventas (TDSI-306, ventasCajeroService.anularVenta):
// validar la venta -> cambiar todas sus filas en UNA transacción SQL -> avisar al monitoreo.
// La diferencia es que aquí además se envía la reversión a la pasarela, con reintentos.
// Contrato para el Equipo 1: docs/contrato-reversion.md (TDSI-1027).

const FORMATO_ID = /^[A-Za-z0-9_-]{1,60}$/;
const MOTIVO_MIN = 10;
const MOTIVO_MAX = 300;
const TEXTO_MAX = 100;

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// Intentos por envío y espera entre intentos (se leen al usarlos, así los tests pueden cambiarlos)
const intentosPorEnvio = () => Math.max(1, Number(process.env.PASARELA_INTENTOS || 3));
const esperaEntreIntentos = () => Math.max(0, Number(process.env.PASARELA_ESPERA_MS ?? 500));

function texto(valor, campo, { requerido = true, max = TEXTO_MAX } = {}) {
  if (Array.isArray(valor)) throw new AppError(`El campo '${campo}' debe enviarse una sola vez.`, 400);
  const limpio = valor === undefined || valor === null ? "" : String(valor).trim();
  if (requerido && !limpio) throw new AppError(`Falta el campo '${campo}'.`, 400);
  if (limpio.length > max) throw new AppError(`El campo '${campo}' admite hasta ${max} caracteres.`, 400);
  return limpio || null;
}

function validarId(id, campo = "id_transaccion") {
  const limpio = texto(id, campo, { max: 60 });
  if (!FORMATO_ID.test(limpio)) throw new AppError(`El ${campo} no tiene un formato válido.`, 400, { [campo]: limpio });
  return limpio;
}

/**
 * Reglas para poder revertir (se aplican con las filas bloqueadas). Devuelve el monto a revertir:
 * la suma de lo pagado con Tarjeta (en un pago mixto, solo la parte con tarjeta).
 */
function validarVenta(id_transaccion, filas, reversionPrevia) {
  if (filas.length === 0) {
    throw new AppError(`No existe una venta con el número "${id_transaccion}".`, 404);
  }
  if (reversionPrevia || filas.some((f) => f.estado === "Revertido")) {
    throw new AppError(
      `La venta "${id_transaccion}" ya tiene una reversión registrada; no se puede revertir dos veces.`,
      409,
      { reversion_id: reversionPrevia ? Number(reversionPrevia.id) : null, estado: reversionPrevia ? reversionPrevia.estado : "Revertido" }
    );
  }
  if (filas.some((f) => f.estado === "Anulado" || f.estado === "AnulacionSolicitada")) {
    throw new AppError(`La venta "${id_transaccion}" está anulada o tiene una anulación en curso; no se puede revertir.`, 409);
  }
  if (filas.some((f) => f.estado_pago !== "APROBADA")) {
    throw new AppError(`El cobro de la venta "${id_transaccion}" no está aprobado; no hay nada que revertir.`, 409);
  }
  const conTarjeta = filas.filter((f) => f.metodo === "Tarjeta");
  if (conTarjeta.length === 0) {
    const metodos = [...new Set(filas.map((f) => f.metodo))].join(" y ");
    throw new AppError(
      `Solo se revierten pagos con tarjeta. La venta "${id_transaccion}" se pagó con ${metodos}: use otro tipo de reembolso.`,
      409,
      { metodos: filas.map((f) => f.metodo) }
    );
  }
  return Math.round(conTarjeta.reduce((s, f) => s + f.monto, 0) * 100) / 100;
}

/**
 * Envía la reversión a la pasarela hasta `intentosPorEnvio()` veces, esperando un poco más
 * en cada reintento. Si confirma: CONFIRMADA (y las filas de tarjeta pasan a Revertido).
 * Si falla todas: ERROR con el último error; se puede volver a intentar con reintentar().
 */
async function enviarAPasarela(reversion, { pasarela = crearPasarelaSimulada() } = {}) {
  const maximo = intentosPorEnvio();
  let intentos = reversion.intentos;
  let ultimoError = null;

  for (let i = 1; i <= maximo; i += 1) {
    intentos += 1;
    try {
      const { referencia } = await pasarela.revertir({
        reversion_id: reversion.id,
        id_transaccion: reversion.id_transaccion,
        monto: reversion.monto,
      });
      const confirmada = await repo.confirmar(reversion.id, { intentos, referencia });
      emitirActualizacion(); // TDSI-123: el monitoreo en vivo muestra la venta como REVERTIDA
      return confirmada;
    } catch (e) {
      ultimoError = e.message;
      if (i < maximo) await esperar(esperaEntreIntentos() * i);
    }
  }
  return repo.registrarError(reversion.id, { intentos, error: ultimoError });
}

/** POST /api/pagos/reversiones: registra la reversión y la envía a la pasarela. */
async function crearReversion(datos = {}, opciones = {}) {
  const id_transaccion = validarId(datos.id_transaccion);
  const motivo = texto(datos.motivo, "motivo", { max: MOTIVO_MAX });
  if (motivo.length < MOTIVO_MIN) {
    throw new AppError(`El motivo debe tener entre ${MOTIVO_MIN} y ${MOTIVO_MAX} caracteres.`, 400);
  }
  const solicitado_por = texto(datos.solicitado_por, "solicitado_por");
  const devolucion_id = texto(datos.devolucion_id, "devolucion_id", { requerido: false, max: 60 });

  let reversion;
  try {
    reversion = await repo.crear({ id_transaccion, motivo, solicitado_por, devolucion_id }, (filas, previa) =>
      validarVenta(id_transaccion, filas, previa)
    );
  } catch (e) {
    // Dos pedidos a la vez: el segundo choca con UNIQUE(id_transaccion)
    if (e.code === "23505") {
      throw new AppError(`La venta "${id_transaccion}" ya tiene una reversión registrada; no se puede revertir dos veces.`, 409);
    }
    throw e;
  }
  return enviarAPasarela(reversion, opciones);
}

/** POST /api/pagos/reversiones/:id/reintentar: vuelve a enviar una reversión en ERROR. */
async function reintentarReversion(id, opciones = {}) {
  const reversionId = Number(id);
  if (!Number.isInteger(reversionId) || reversionId <= 0) throw new AppError("El id de la reversión no es válido.", 400);

  const tomada = await repo.tomarParaReintento(reversionId);
  if (!tomada) {
    const actual = await repo.obtener(reversionId);
    if (!actual) throw new AppError("No existe esa reversión.", 404);
    throw new AppError(
      actual.estado === "CONFIRMADA"
        ? "La reversión ya fue confirmada por la pasarela; no hace falta reintentar."
        : "La reversión se está enviando en este momento; espere el resultado.",
      409,
      { estado: actual.estado }
    );
  }
  return enviarAPasarela(tomada, opciones);
}

async function obtenerReversion(id) {
  const reversionId = Number(id);
  if (!Number.isInteger(reversionId) || reversionId <= 0) throw new AppError("El id de la reversión no es válido.", 400);
  const r = await repo.obtener(reversionId);
  if (!r) throw new AppError("No existe esa reversión.", 404);
  return r;
}

async function listarReversiones({ id_transaccion, devolucion_id, estado } = {}) {
  const filtros = {
    id_transaccion: id_transaccion === undefined ? null : validarId(id_transaccion),
    devolucion_id: texto(devolucion_id, "devolucion_id", { requerido: false, max: 60 }),
    estado: texto(estado, "estado", { requerido: false, max: 20 }),
  };
  if (filtros.estado && !["ENVIADA", "CONFIRMADA", "ERROR"].includes(filtros.estado)) {
    throw new AppError("El estado debe ser ENVIADA, CONFIRMADA o ERROR.", 400);
  }
  return repo.listar(filtros);
}

module.exports = { crearReversion, reintentarReversion, obtenerReversion, listarReversiones, validarVenta };
