const { obtenerReporteDevoluciones } = require("./devolucionesProxy");
const { listarTickets } = require("./soporteProxy");
const { calcularRecaudadoPorCaja } = require("./recaudadoService");
const {
  validarFiltros, filtrosPublicos, semaforo, semaforoMenorEsMejor, porcentaje, plural, redondear, tarjeta,
} = require("./kpiComun");

// TDSI-639/1130: pestaña "Devoluciones y soporte" del Tablero de KPIs (KPI-9 y KPI-10).
// Los datos son de otros microservicios (Devoluciones, Gestion de pagos y Soporte), por HTTP.
// Si alguno no responde, ese KPI devuelve 502 y la pantalla muestra el error con "Reintentar":
// nunca se inventa un valor.

// ---------- KPI-9 Tasa de devoluciones ----------
const KPI9 = {
  kpi: "KPI-9",
  nombre: "Tasa de devoluciones",
  formula: "Σ monto devuelto (APROBADA o PROCESADA) ÷ Σ monto vendido × 100, desglosado por motivo",
  meta: "Meta: ≤ 2 % · Atención: 2 % – 4 % · Fuera de meta: > 4 %",
};
const RANGOS_KPI9 = { meta: 2, atencion: 4 };
const ESTADOS_DEVUELTOS = ["APROBADA", "PROCESADA"];
const SIN_MOTIVO = "Sin motivo";

/** Monto vendido del periodo: lo recaudado por caja en gestion_pagos (como Metas de venta). */
async function montoVendido(filtros) {
  const r = await calcularRecaudadoPorCaja({ caja_id: filtros.caja_id || undefined, desde: filtros.desde, hasta: filtros.hasta });
  const cajas = Array.isArray(r) ? r : [r];
  return redondear(cajas.reduce((t, c) => t + Number(c.totalRecaudado || 0), 0), 2);
}

/**
 * KPI-9: de lo vendido en el periodo, que porcentaje se devolvio. Solo cuentan las devoluciones
 * APROBADAS o PROCESADAS (las PENDIENTES todavia no y las RECHAZADAS no devuelven dinero).
 * Desglose por motivo (grafico "Devoluciones por motivo") y segunda tarjeta "Monto devuelto"
 * con parciales y totales. El filtro de caja aplica (devolucion y venta tienen caja); el de
 * cajero no (una devolucion no es de un cajero).
 */
async function calcularTasaDevoluciones(filtros) {
  const [reporte, vendido] = await Promise.all([
    obtenerReporteDevoluciones({ desde: filtros.desde, hasta: filtros.hasta }),
    montoVendido(filtros),
  ]);
  const delPeriodo = (reporte.devoluciones || []).filter((d) => !filtros.caja_id || d.caja_id === filtros.caja_id);
  const devueltas = delPeriodo.filter((d) => ESTADOS_DEVUELTOS.includes(d.estado));
  const devuelto = redondear(devueltas.reduce((t, d) => t + Number(d.monto_total || 0), 0), 2);
  const tasa = vendido > 0 ? (devuelto / vendido) * 100 : null;
  const parciales = devueltas.filter((d) => d.tipo === "PARCIAL").length;

  const motivos = new Map();
  for (const d of devueltas) {
    const m = motivos.get(d.motivo || SIN_MOTIVO) || { cantidad: 0, monto: 0 };
    m.cantidad += 1;
    m.monto += Number(d.monto_total || 0);
    motivos.set(d.motivo || SIN_MOTIVO, m);
  }
  const porMotivo = [...motivos]
    .map(([motivo, m]) => ({ motivo, cantidad: m.cantidad, monto: redondear(m.monto, 2), porcentaje: porcentaje(m.cantidad, devueltas.length) }))
    .sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto || a.motivo.localeCompare(b.motivo));

  return tarjeta({
    ...KPI9,
    valor: redondear(tasa, 1),
    unidad: "%",
    sem: semaforoMenorEsMejor(tasa, RANGOS_KPI9),
    detalle: plural(devueltas.length, "devolución", "devoluciones"),
    monto_devuelto: {
      nombre: "Monto devuelto",
      valor: devuelto,
      unidad: "Bs",
      detalle: `${plural(parciales, "parcial", "parciales")} · ${plural(devueltas.length - parciales, "total", "totales")}`,
    },
    datos: {
      devoluciones: devueltas.length,
      parciales,
      totales: devueltas.length - parciales,
      monto_devuelto: devuelto,
      monto_vendido: vendido,
      no_cuentan: {
        pendientes: delPeriodo.filter((d) => d.estado === "PENDIENTE").length,
        rechazadas: delPeriodo.filter((d) => d.estado === "RECHAZADA").length,
      },
    },
    por_motivo: porMotivo,
    filtros_que_no_aplican: ["cajero_id"],
  });
}

// ---------- KPI-10 Tiempo de resolucion de soporte ----------
const KPI10 = {
  kpi: "KPI-10",
  nombre: "Tiempo de resolución de soporte",
  formula: "Promedio(fecha de resolución − fecha de registro) de tickets resueltos, por prioridad",
  meta: "Meta: ≤ 24 h (Crítica ≤ 4 h) · Atención: 24 – 48 h · Fuera de meta: > 48 h o Crítica > 4 h",
};
const RANGOS_KPI10 = { meta: 24, atencion: 48 };
const LIMITE_CRITICA_H = 4;
const PRIORIDADES = [
  { codigo: "Critica", nombre: "Crítica" },
  { codigo: "Alta", nombre: "Alta" },
  { codigo: "Media", nombre: "Media" },
  { codigo: "Baja", nombre: "Baja" },
];
const HORA_MS = 60 * 60 * 1000;
const promedio = (valores) => (valores.length ? valores.reduce((t, v) => t + v, 0) / valores.length : null);

/** Semaforo de una prioridad: la Critica tiene su propia meta (<= 4 h, si no en rojo). */
function semaforoPrioridad(codigo, horas) {
  if (horas === null) return semaforo("SIN_DATOS");
  if (codigo === "Critica") return semaforo(horas <= LIMITE_CRITICA_H ? "EN_META" : "FUERA_DE_META");
  return semaforoMenorEsMejor(horas, RANGOS_KPI10);
}

/**
 * KPI-10: cuanto tarda Soporte en resolver un ticket: promedio de resuelto_en - creado_en de
 * los tickets registrados en el periodo que ya se resolvieron (los abiertos no cuentan), en
 * horas con 1 decimal, general y por prioridad (grafico "Tiempo de resolucion por prioridad").
 * La Critica va en rojo si pasa las 4 h, y cada ticket critico de mas de 4 h se lista. Segunda
 * tarjeta "Tickets criticos". Soporte no filtra por caja ni cajero.
 */
async function calcularResolucionSoporte(filtros, authorization) {
  const tickets = await listarTickets({ desde: filtros.desde, hasta: filtros.hasta, authorization });
  const resueltos = tickets
    .filter((t) => t.resuelto_en && t.creado_en)
    .map((t) => ({ ...t, horas: (new Date(t.resuelto_en) - new Date(t.creado_en)) / HORA_MS }));
  const general = promedio(resueltos.map((t) => t.horas));

  const porPrioridad = PRIORIDADES.map(({ codigo, nombre }) => {
    const deEsta = resueltos.filter((t) => t.prioridad === codigo);
    const horas = promedio(deEsta.map((t) => t.horas));
    const sem = semaforoPrioridad(codigo, horas);
    return {
      prioridad: codigo,
      nombre,
      resueltos: deEsta.length,
      promedio_horas: redondear(horas, 1),
      semaforo: sem,
      en_rojo: sem.estado === "FUERA_DE_META",
    };
  });
  const critica = porPrioridad[0];
  const criticasFuera = resueltos
    .filter((t) => t.prioridad === "Critica" && t.horas > LIMITE_CRITICA_H)
    .map((t) => ({ numero: t.numero, horas: redondear(t.horas, 1) }));

  const sem = general === null
    ? semaforo("SIN_DATOS")
    : critica.en_rojo ? semaforo("FUERA_DE_META") : semaforoMenorEsMejor(general, RANGOS_KPI10);

  return tarjeta({
    ...KPI10,
    valor: redondear(general, 1),
    unidad: "h",
    sem,
    detalle: "Promedio general",
    tickets_criticos: {
      nombre: "Tickets críticos",
      valor: critica.promedio_horas,
      unidad: "h",
      semaforo: critica.semaforo,
      detalle: `Meta ≤ ${LIMITE_CRITICA_H} h`,
      mas_de_4h: criticasFuera,
    },
    datos: {
      registrados: tickets.length,
      resueltos: resueltos.length,
      sin_resolver: tickets.length - resueltos.length,
    },
    por_prioridad: porPrioridad,
    filtros_que_no_aplican: ["caja_id", "cajero_id"],
  });
}

// ---------- rutas ----------
/** GET /api/kpis/devoluciones-soporte/tasa-devoluciones */
async function tasaDevoluciones(query) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularTasaDevoluciones(filtros) };
}

/** GET /api/kpis/devoluciones-soporte/resolucion-soporte */
async function resolucionSoporte(query, authorization) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularResolucionSoporte(filtros, authorization) };
}

/**
 * GET /api/kpis/devoluciones-soporte: las tarjetas de la pestaña. Si Devoluciones o Soporte no
 * responden, ese KPI queda en null y su mensaje en "errores" (el otro se muestra igual).
 */
async function pestanaDevolucionesSoporte(query, authorization) {
  const filtros = await validarFiltros(query);
  const [devs, soporte] = await Promise.allSettled([
    calcularTasaDevoluciones(filtros),
    calcularResolucionSoporte(filtros, authorization),
  ]);
  const errores = {};
  const valor = (resultado, clave) => {
    if (resultado.status === "fulfilled") return resultado.value;
    if (!(resultado.reason?.status >= 500)) throw resultado.reason;
    errores[clave] = resultado.reason.message;
    return null;
  };
  const kpis = {
    tasa_devoluciones: valor(devs, "tasa_devoluciones"),
    resolucion_soporte: valor(soporte, "resolucion_soporte"),
  };
  return { filtros: filtrosPublicos(filtros), kpis, errores };
}

module.exports = {
  tasaDevoluciones, resolucionSoporte, pestanaDevolucionesSoporte,
  calcularTasaDevoluciones, calcularResolucionSoporte, KPI9, KPI10,
};
