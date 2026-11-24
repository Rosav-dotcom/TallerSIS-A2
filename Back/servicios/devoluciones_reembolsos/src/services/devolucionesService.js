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
      item_id: num(it.factura_item_id),
      codigo_producto: it.codigo_producto ?? null,
      descripcion: it.descripcion,
      cantidad: num(it.cantidad),
      precio_unitario: num(it.precio_unitario),
      subtotal: num(it.subtotal),
      condicion: it.condicion,
    })),
  };
}

const ESTADOS = ["PENDIENTE", "APROBADA", "RECHAZADA", "PROCESADA"];
const OFFSET_BOLIVIA = "-04:00";
const vacio = (v) => v === undefined || (typeof v === "string" && !v.trim());

/** "YYYY-MM-DD" (dia de Bolivia) -> instante de inicio o fin de ese dia. */
function limiteDelDia(valor, campo, fin) {
  const dia = String(valor).trim();
  const d = new Date(`${dia}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dia) {
    throw new AppError(`'${campo}' debe ser una fecha con formato AAAA-MM-DD.`, 400, { [campo]: valor });
  }
  const inicio = new Date(`${dia}T00:00:00${OFFSET_BOLIVIA}`);
  return fin ? new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1) : inicio;
}

/**
 * TDSI-76/1112: buscador "Buscar por codigo DEV-..." de la lista. Sin "codigo" trae las
 * ultimas devoluciones; con "codigo" (DEV-000123, dev-123, 123, o leido con el lector de
 * codigo de barras) trae solo esa, o la lista vacia si no existe.
 * TDSI-70: filtros "Estado" y rango de fechas (desde/hasta, dias de Bolivia, inclusive).
 */
async function listarDevoluciones({ codigo, estado, desde, hasta } = {}) {
  const filtros = {};
  if (!vacio(codigo)) {
    filtros.codigo = normalizarCodigo(codigo);
    if (!filtros.codigo) throw new AppError("El código debe tener la forma DEV-000123.", 400, { codigo });
  }
  if (!vacio(estado)) {
    filtros.estado = typeof estado === "string" ? estado.trim().toUpperCase() : null;
    if (!ESTADOS.includes(filtros.estado)) {
      throw new AppError(`El estado debe ser uno de: ${ESTADOS.join(", ")}.`, 400, { estado });
    }
  }
  if (!vacio(desde)) filtros.desde = limiteDelDia(desde, "desde", false);
  if (!vacio(hasta)) filtros.hasta = limiteDelDia(hasta, "hasta", true);
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new AppError("'desde' no puede ser posterior a 'hasta'.", 400, { desde, hasta });
  }
  return (await devolucionesRepo.listar(filtros)).map(aResumen);
}

/** TDSI-76/1112: detalle de /devoluciones/:codigo, con sus items. */
async function obtenerDevolucion(codigo) {
  const normalizado = normalizarCodigo(codigo);
  const devolucion = normalizado ? await devolucionesRepo.buscarPorCodigo(normalizado) : null;
  if (!devolucion) throw new AppError(NO_ENCONTRADA, 404, { codigo });
  return aDetalle(devolucion);
}

module.exports = { listarDevoluciones, obtenerDevolucion, aDetalle, ESTADOS, NO_ENCONTRADA };
