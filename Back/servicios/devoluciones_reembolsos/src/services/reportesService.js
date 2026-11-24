const { AppError } = require("../utils/AppError");
const reportesRepo = require("../data/reportesRepo");
const motivosRepo = require("../data/motivosRepo");
const { OPCIONES } = require("./opcionesReembolsoService");
const { ESTADOS, limiteDelDia } = require("./devolucionesService");
const { SUCURSALES, SUCURSAL_POR_DEFECTO } = require("../config/sucursal");

// TDSI-82/241: reporte periodico de devoluciones y notas de credito del Encargado de Devoluciones.
const MAX_DIAS = 366; // un reporte cubre hasta un año
const DIA_MS = 24 * 60 * 60 * 1000;
const vacio = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());
const num = (v) => (v === null || v === undefined ? null : Number(v));
const redondear = (n) => Math.round(n * 100) / 100;
const nombreMetodo = (codigo) => (codigo ? (OPCIONES.find((o) => o.codigo === codigo)?.nombre ?? codigo) : null);
const texto = (v) => (typeof v === "string" ? v.trim() : String(v ?? "").trim());

/**
 * Valida los filtros de la pantalla "Reportes" (query string). Desde y hasta son obligatorios
 * (AAAA-MM-DD, dias de Bolivia, inclusive); sucursal, estado, motivo_id y metodo (opcion de
 * reembolso: EFECTIVO, REVERSION_TARJETA o VALE, o su nombre) son opcionales.
 */
async function validarFiltros({ desde, hasta, sucursal, estado, motivo_id: motivoId, metodo } = {}) {
  if (vacio(desde) || vacio(hasta)) {
    throw new AppError("Elija el rango de fechas del reporte (desde y hasta, AAAA-MM-DD).", 400, { desde, hasta });
  }
  const inicio = limiteDelDia(desde, "desde", false);
  const fin = limiteDelDia(hasta, "hasta", true);
  if (inicio > fin) throw new AppError("'desde' no puede ser posterior a 'hasta'.", 400, { desde, hasta });
  if (Math.round((fin - inicio) / DIA_MS) > MAX_DIAS) {
    throw new AppError(`El rango del reporte puede ser de hasta ${MAX_DIAS} días.`, 400, { desde, hasta });
  }
  const filtros = { desde: texto(desde), hasta: texto(hasta), inicio, fin, sucursal: SUCURSAL_POR_DEFECTO,
    estado: null, motivo: null, metodo: null };

  if (!vacio(sucursal)) {
    filtros.sucursal = SUCURSALES.find((s) => s.toLowerCase() === texto(sucursal).toLowerCase());
    if (!filtros.sucursal) {
      throw new AppError(`La sucursal debe ser una de: ${SUCURSALES.join(", ")}.`, 400, { sucursal });
    }
  }
  if (!vacio(estado)) {
    filtros.estado = texto(estado).toUpperCase();
    if (!ESTADOS.includes(filtros.estado)) {
      throw new AppError(`El estado debe ser uno de: ${ESTADOS.join(", ")}.`, 400, { estado });
    }
  }
  if (!vacio(motivoId)) {
    const id = Number(texto(motivoId));
    const motivo = Number.isInteger(id) && id > 0 ? await motivosRepo.buscar(id) : null;
    if (!motivo) throw new AppError("El motivo elegido no existe.", 400, { motivo_id: motivoId });
    filtros.motivo = { id: Number(motivo.id), nombre: motivo.nombre };
  }
  if (!vacio(metodo)) {
    const buscado = texto(metodo).toLowerCase();
    const opcion = OPCIONES.find((o) => o.codigo.toLowerCase() === buscado || o.nombre.toLowerCase() === buscado);
    if (!opcion) {
      throw new AppError(`El método de reembolso debe ser uno de: ${OPCIONES.map((o) => o.nombre).join(", ")}.`, 400,
        { metodo });
    }
    filtros.metodo = { codigo: opcion.codigo, nombre: opcion.nombre };
  }
  return filtros;
}

const aDevolucion = (d, sucursal) => ({
  codigo: d.codigo,
  fecha: d.fecha_solicitud,
  factura_numero: d.factura_numero,
  cliente_nit: d.cliente_nit ?? null,
  tipo: d.tipo,
  motivo: d.motivo ?? null,
  estado: d.estado,
  motivo_rechazo: d.motivo_rechazo ?? null,
  metodo_pago_original: d.metodo_pago_original,
  metodo_reembolso: nombreMetodo(d.opcion_reembolso),
  monto_total: num(d.monto_total),
  sucursal,
  caja_id: d.caja_id ?? null,
  nota_credito: d.nota_credito ?? null,
  registrado_por: d.creado_por ?? null,
  autorizado_por: d.autorizado_por ?? null,
});

const aNotaCredito = (n) => ({
  numero: n.numero,
  fecha: n.emitida_en,
  devolucion_codigo: n.devolucion_codigo,
  factura_numero: n.factura_numero,
  cliente_nit: n.cliente_nit ?? null,
  motivo: n.motivo ?? null,
  metodo_reembolso: nombreMetodo(n.opcion_reembolso),
  monto: num(n.monto),
  estado: n.estado,
  enviada_por_correo: Boolean(n.enviada_por_correo),
});

/** Totales del pie de cada hoja. Las RECHAZADAS no reintegran dinero y las notas ANULADAS no valen. */
function totales(devoluciones, notas) {
  const suma = (filas, campo) => redondear(filas.reduce((t, f) => t + f[campo], 0));
  const vigentes = devoluciones.filter((d) => d.estado !== "RECHAZADA");
  const emitidas = notas.filter((n) => n.estado === "EMITIDA");
  return {
    devoluciones: {
      cantidad: devoluciones.length,
      monto: suma(devoluciones, "monto_total"),
      rechazadas: devoluciones.length - vigentes.length,
      monto_sin_rechazadas: suma(vigentes, "monto_total"),
    },
    notas_credito: {
      cantidad: notas.length,
      emitidas: emitidas.length,
      anuladas: notas.length - emitidas.length,
      monto_emitidas: suma(emitidas, "monto"),
    },
  };
}

/** Filtros tal como se muestran (vista previa y encabezado del Excel). */
const filtrosAplicados = (f) => ({
  desde: f.desde,
  hasta: f.hasta,
  sucursal: f.sucursal,
  estado: f.estado,
  motivo: f.motivo,
  metodo_reembolso: f.metodo,
});

/**
 * GET /api/devoluciones/reportes -- TDSI-82/241: vista previa del reporte con los filtros
 * elegidos (devoluciones y notas de credito, PA TDSI-1062) y sus totales.
 */
async function obtenerReporte(query = {}) {
  const f = await validarFiltros(query);
  const repoFiltros = { inicio: f.inicio, fin: f.fin, estado: f.estado, motivoId: f.motivo?.id ?? null,
    metodo: f.metodo?.codigo ?? null };
  const [filasDev, filasNc] = await Promise.all([
    reportesRepo.devoluciones(repoFiltros),
    reportesRepo.notasCredito(repoFiltros),
  ]);
  const devoluciones = filasDev.map((d) => aDevolucion(d, f.sucursal));
  const notas = filasNc.map(aNotaCredito);
  return {
    filtros: filtrosAplicados(f),
    devoluciones,
    notas_credito: notas,
    totales: totales(devoluciones, notas),
    sin_resultados: devoluciones.length === 0 && notas.length === 0,
  };
}

/** GET /api/devoluciones/reportes/filtros -- TDSI-82/241: opciones de los selectores de la pantalla. */
async function opcionesDeFiltros() {
  const motivos = await motivosRepo.listarTodos();
  return {
    sucursales: SUCURSALES,
    estados: ESTADOS,
    motivos: motivos.map((m) => ({ id: Number(m.id), nombre: m.nombre, activo: m.activo })),
    metodos_reembolso: OPCIONES.map((o) => ({ codigo: o.codigo, nombre: o.nombre })),
    max_dias: MAX_DIAS,
  };
}

module.exports = { validarFiltros, obtenerReporte, opcionesDeFiltros, MAX_DIAS };
