const kpisRepo = require("../data/kpisRepo");
const {
  validarFiltros, filtrosPublicos, semaforoMayorEsMejor, semaforoMenorEsMejor, porcentaje, plural, redondear, tarjeta,
} = require("./kpiComun");

// TDSI-639: pestaña "Caja" del Tablero de KPIs (KPI-3, KPI-4 y KPI-7).

// ---------- KPI-3 Exactitud de arqueo (TDSI-643) ----------
const KPI3 = {
  kpi: "KPI-3",
  nombre: "Exactitud de arqueo",
  formula: "Turnos CERRADOS con tipo_diferencia = CUADRA ÷ Turnos CERRADOS × 100",
  meta: "Meta: ≥ 95 % · Atención: 85 % – 95 % · Fuera de meta: < 85 %",
};
const RANGOS_KPI3 = { meta: 95, atencion: 85 };

/**
 * KPI-3: de los turnos CERRADOS en el periodo, que porcentaje cuadro (PA TDSI-646). Un turno
 * cerrado sin arqueo cuenta como cerrado y no como cuadrado (nadie conto el efectivo).
 * Incluye el detalle por cajero para el grafico "% de turnos que cuadran por cajero".
 */
async function calcularExactitudArqueo(filtros) {
  const filas = await kpisRepo.arqueoPorCajero(filtros);
  const suma = (campo) => filas.reduce((t, f) => t + f[campo], 0);
  const cerrados = suma("cerrados");
  const cuadran = suma("cuadran");
  const valor = porcentaje(cuadran, cerrados);
  const faltantes = suma("faltantes");
  return tarjeta({
    ...KPI3,
    valor,
    unidad: "%",
    sem: semaforoMayorEsMejor(valor, RANGOS_KPI3),
    detalle: cerrados === 0 ? "Sin turnos cerrados en el periodo" : `${plural(faltantes, "turno", "turnos")} con faltante`,
    datos: { cerrados, cuadran, faltantes, sobrantes: suma("sobrantes"), sin_arqueo: suma("sin_arqueo") },
    por_cajero: filas.map((f) => {
      const p = porcentaje(f.cuadran, f.cerrados);
      return {
        cajero_id: f.cajero_id,
        cajero_nombre: f.cajero_nombre,
        cerrados: f.cerrados,
        cuadran: f.cuadran,
        faltantes: f.faltantes,
        sobrantes: f.sobrantes,
        sin_arqueo: f.sin_arqueo,
        porcentaje: p,
        semaforo: semaforoMayorEsMejor(p, RANGOS_KPI3),
      };
    }),
  });
}

// ---------- KPI-4 Tiempo de autorizacion (TDSI-1090) ----------
const KPI4 = {
  kpi: "KPI-4",
  nombre: "Tiempo de autorización",
  formula: "Promedio(resuelto_en − solicitado_en) de solicitudes APROBADAS o RECHAZADAS",
  meta: "Meta: ≤ 3 min · Atención: 3 – 10 min · Fuera de meta: > 10 min",
};
const RANGOS_KPI4 = { meta: 3, atencion: 10 };
const minutos = (segundos, cantidad) => (cantidad > 0 ? redondear(segundos / cantidad / 60, 1) : null);

/**
 * KPI-4: cuanto tarda un supervisor en aprobar o rechazar una apertura o un cierre de caja:
 * promedio de resuelto_en - solicitado_en (PA TDSI-647) de las solicitudes resueltas en el
 * periodo; las PENDIENTES no cuentan. En minutos con 1 decimal; por mes (grafico "Tiempo de
 * autorizacion por mes") y por tipo (apertura / cierre).
 */
async function calcularTiempoAutorizacion(filtros) {
  const filas = await kpisRepo.autorizacionesResueltas(filtros);
  const agrupar = (clave) => {
    const grupos = new Map();
    for (const f of filas) {
      const g = grupos.get(f[clave]) || { resueltas: 0, aprobadas: 0, segundos: 0 };
      g.resueltas += f.resueltas;
      g.aprobadas += f.aprobadas;
      g.segundos += f.segundos;
      grupos.set(f[clave], g);
    }
    return [...grupos].map(([valor, g]) => ({
      [clave]: valor,
      resueltas: g.resueltas,
      aprobadas: g.aprobadas,
      rechazadas: g.resueltas - g.aprobadas,
      promedio_minutos: minutos(g.segundos, g.resueltas),
    }));
  };
  const resueltas = filas.reduce((t, f) => t + f.resueltas, 0);
  const aprobadas = filas.reduce((t, f) => t + f.aprobadas, 0);
  const segundos = filas.reduce((t, f) => t + f.segundos, 0);
  const valor = minutos(segundos, resueltas);
  return tarjeta({
    ...KPI4,
    valor,
    unidad: "min",
    sem: semaforoMenorEsMejor(valor, RANGOS_KPI4),
    detalle: resueltas === 0 ? "Sin solicitudes resueltas en el periodo" : `${plural(resueltas, "solicitud resuelta", "solicitudes resueltas")}`,
    datos: {
      resueltas,
      aprobadas,
      rechazadas: resueltas - aprobadas,
      promedio_segundos: resueltas > 0 ? Math.round(segundos / resueltas) : null,
    },
    por_mes: agrupar("mes").map((m) => ({ ...m, semaforo: semaforoMenorEsMejor(m.promedio_minutos, RANGOS_KPI4) })),
    por_tipo: agrupar("tipo"),
  });
}

/** GET /api/kpis/caja/tiempo-autorizacion */
async function tiempoAutorizacion(query) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularTiempoAutorizacion(filtros) };
}

/** GET /api/kpis/caja/exactitud-arqueo */
async function exactitudArqueo(query) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularExactitudArqueo(filtros) };
}

/** GET /api/kpis/caja: las tarjetas de la pestaña "Caja" con los mismos filtros. */
async function pestanaCaja(query) {
  const filtros = await validarFiltros(query);
  const [exactitud, autorizacion] = await Promise.all([
    calcularExactitudArqueo(filtros),
    calcularTiempoAutorizacion(filtros),
  ]);
  return {
    filtros: filtrosPublicos(filtros),
    kpis: { exactitud_arqueo: exactitud, tiempo_autorizacion: autorizacion },
  };
}

module.exports = {
  exactitudArqueo, tiempoAutorizacion, pestanaCaja, calcularExactitudArqueo, calcularTiempoAutorizacion, KPI3, KPI4,
};
