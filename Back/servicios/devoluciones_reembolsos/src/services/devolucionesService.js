const { AppError } = require("../utils/AppError");
const { normalizarCodigo } = require("../utils/codigoDevolucion");
const devolucionesRepo = require("../data/devolucionesRepo");
const historialRepo = require("../data/historialRepo");
const { OPCIONES } = require("./opcionesReembolsoService");

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
    motivo: d.motivo_nombre ?? null, // TDSI-71/1103
    motivo_rechazo: d.motivo_rechazo ?? null, // TDSI-78/1117: chip RECHAZADA y su motivo en la lista
  };
}

/** TDSI-72/1106: { codigo, nombre } de la opcion de reembolso elegida; null si no tiene. */
const aOpcion = (codigo) => {
  if (!codigo) return null;
  const opcion = OPCIONES.find((o) => o.codigo === codigo);
  return { codigo, nombre: opcion ? opcion.nombre : codigo };
};

/** TDSI-71/1103: { id, nombre } del motivo elegido; null en devoluciones sin motivo. */
const aMotivo = (d) => (d.motivo_id === null || d.motivo_id === undefined
  ? null
  : { id: Number(d.motivo_id), nombre: d.motivo_nombre ?? null });

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
    motivo_id: num(d.motivo_id),
    motivo: aMotivo(d),
    observaciones: d.observaciones ?? null,
    metodo_pago_original: d.metodo_pago_original,
    caja_id: d.caja_id ?? null, // TDSI-80/1069
    opcion_reembolso: aOpcion(d.opcion_reembolso), // TDSI-72/1106
    monto_total: num(d.monto_total),
    estado: d.estado,
    motivo_rechazo: d.motivo_rechazo,
    // TDSI-78/1117: bloque "Motivo del rechazo" del detalle (null si no esta rechazada)
    rechazo: d.estado === "RECHAZADA"
      ? { motivo: d.motivo_rechazo, usuario: d.rechazado_por ?? null, fecha: d.rechazado_en ?? null }
      : null,
    requiere_autorizacion: d.requiere_autorizacion,
    autorizado_por: d.autorizado_por,
    autorizado_en: d.autorizado_en,
    // TDSI-80/1085: bloque "Autorizado por" del detalle (PA TDSI-1056); null si no hizo falta
    autorizacion: d.autorizado_por
      ? { supervisor_id: d.autorizado_por, nombre: d.autorizado_por_nombre ?? null, fecha: d.autorizado_en ?? null }
      : null,
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

/**
 * GET /api/devoluciones/:codigo/historial -- TDSI-81/1057: linea de tiempo de la devolucion,
 * cada cambio de estado con usuario y hora (PA TDSI-1058), en orden cronologico (PA TDSI-1060).
 * Solo lectura: no hay ruta para editar ni borrar el historial (PA TDSI-1059, TDSI-239).
 */
async function obtenerHistorial(codigo) {
  const normalizado = normalizarCodigo(codigo);
  const devolucion = normalizado ? await devolucionesRepo.buscarPorCodigo(normalizado) : null;
  if (!devolucion) throw new AppError(NO_ENCONTRADA, 404, { codigo });
  const filas = await historialRepo.listarPorDevolucion(devolucion.id);
  return {
    codigo: devolucion.codigo,
    estado: devolucion.estado,
    historial: filas.map((h) => ({
      estado_anterior: h.estado_anterior,
      estado_nuevo: h.estado_nuevo,
      usuario: h.cambiado_por,
      fecha: h.cambiado_en,
      comentario: h.comentario,
    })),
  };
}

/**
 * GET /api/devoluciones/del-dia?fecha=AAAA-MM-DD -- TDSI-80/1069: las devoluciones del dia
 * (de Bolivia; por defecto hoy) que reintegran dinero, para el resumen por caja que arma
 * gestion_caja (TDSI-1069). Sin las RECHAZADAS.
 */
async function devolucionesDelDia({ fecha } = {}) {
  const dia = vacio(fecha)
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date())
    : String(fecha).trim();
  const desde = limiteDelDia(dia, "fecha", false);
  const hasta = limiteDelDia(dia, "fecha", true);
  const filas = await devolucionesRepo.delPeriodo(desde, hasta);
  return {
    fecha: dia,
    devoluciones: filas.map((d) => ({
      codigo: d.codigo,
      caja_id: d.caja_id ?? null,
      fecha: d.fecha_solicitud,
      estado: d.estado,
      monto_total: num(d.monto_total),
      opcion_reembolso: aOpcion(d.opcion_reembolso),
      autorizado_por: d.autorizado_por ?? null,
      autorizado_por_nombre: d.autorizado_por_nombre ?? null,
      registrado_por: d.creado_por ?? null,
    })),
  };
}

module.exports = {
  listarDevoluciones, obtenerDevolucion, obtenerHistorial, devolucionesDelDia, aDetalle, ESTADOS, NO_ENCONTRADA,
};
