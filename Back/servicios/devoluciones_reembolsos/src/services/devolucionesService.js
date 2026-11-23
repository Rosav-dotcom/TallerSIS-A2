const { AppError } = require("../utils/AppError");
const { normalizarCodigo } = require("../utils/codigoDevolucion");
const devolucionesRepo = require("../data/devolucionesRepo");

const NO_ENCONTRADA = "Devolución no encontrada";
const num = (v) => (v === null || v === undefined ? null : Number(v));

function aResumen(d) {
  return {
    codigo: d.codigo,
    factura_numero: d.factura_numero,
    cliente_nit: d.cliente_nit,
    fecha: d.fecha_solicitud,
    tipo: d.tipo,
    estado: d.estado,
    monto_total: num(d.monto_total),
  };
}

function aDetalle(d) {
  return {
    codigo: d.codigo,
    factura_numero: d.factura_numero,
    venta_id: d.venta_id,
    cliente_nit: d.cliente_nit,
    fecha_venta: d.fecha_venta,
    fecha: d.fecha_solicitud,
    dentro_de_plazo: d.dentro_de_plazo,
    tipo: d.tipo,
    motivo_id: d.motivo_id,
    observaciones: d.observaciones,
    metodo_pago_original: d.metodo_pago_original,
    monto_total: num(d.monto_total),
    estado: d.estado,
    motivo_rechazo: d.motivo_rechazo,
    requiere_autorizacion: d.requiere_autorizacion,
    autorizado_por: d.autorizado_por,
    autorizado_en: d.autorizado_en,
    creado_por: d.creado_por,
    items: (d.items || []).map((it) => ({
      descripcion: it.descripcion,
      cantidad: num(it.cantidad),
      precio_unitario: num(it.precio_unitario),
      subtotal: num(it.subtotal),
    })),
  };
}

/**
 * TDSI-76/1112: buscador "Buscar por codigo DEV-..." de la lista. Sin "codigo" trae las
 * ultimas devoluciones; con "codigo" (DEV-000123, dev-123, 123, o leido con el lector de
 * codigo de barras) trae solo esa, o la lista vacia si no existe.
 */
async function listarDevoluciones({ codigo } = {}) {
  if (codigo === undefined || (typeof codigo === "string" && !codigo.trim())) {
    return (await devolucionesRepo.listar()).map(aResumen);
  }
  const normalizado = normalizarCodigo(codigo);
  if (!normalizado) {
    throw new AppError("El código debe tener la forma DEV-000123.", 400, { codigo });
  }
  return (await devolucionesRepo.listar({ codigo: normalizado })).map(aResumen);
}

/** TDSI-76/1112: detalle de /devoluciones/:codigo, con sus items. */
async function obtenerDevolucion(codigo) {
  const normalizado = normalizarCodigo(codigo);
  const devolucion = normalizado ? await devolucionesRepo.buscarPorCodigo(normalizado) : null;
  if (!devolucion) throw new AppError(NO_ENCONTRADA, 404, { codigo });
  return aDetalle(devolucion);
}

module.exports = { listarDevoluciones, obtenerDevolucion, NO_ENCONTRADA };
