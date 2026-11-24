const kpisRepo = require("../data/kpisRepo");
const {
  validarFiltros, filtrosPublicos, semaforo, semaforoMayorEsMejor, semaforoMenorEsMejor, porcentaje, plural, redondear,
  bs, tarjeta,
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

// ---------- KPI-7 Monto de diferencias de caja (TDSI-644) ----------
const KPI7 = {
  kpi: "KPI-7",
  nombre: "Monto de diferencias de caja",
  formula: "Faltante = Σ monto FALTANTE · Sobrante = Σ monto SOBRANTE · % resueltas = resueltas ÷ registradas × 100",
  meta: "Meta: faltante ≤ Bs 100 por semana · Atención: Bs 100 – 300 · Fuera de meta: > Bs 300 o diferencias sin resolver",
};
const RANGOS_KPI7 = { meta: 100, atencion: 300 }; // Bs de faltante por semana

/**
 * Semaforo del KPI-7: cualquier diferencia sin resolver lo deja Fuera de meta; si no, el
 * faltante por semana del periodo (faltante / semanas, una semana como minimo) contra Bs 100
 * y Bs 300.
 */
function semaforoDiferencias({ faltante, pendientes, dias }) {
  if (pendientes > 0) return semaforo("FUERA_DE_META");
  return semaforoMenorEsMejor(faltante / Math.max(1, dias / 7), RANGOS_KPI7);
}

/**
 * KPI-7: cuanto dinero esta en juego por diferencias de caja en el periodo: faltantes y
 * sobrantes por separado, % resueltas y cuantas siguen pendientes (PA TDSI-648). El valor de
 * la tarjeta es el faltante (Bs). Incluye el detalle por caja para el grafico "Diferencias por
 * caja" (barras Faltante y Sobrante).
 */
async function calcularDiferencias(filtros) {
  const filas = await kpisRepo.diferenciasPorCaja(filtros);
  const suma = (campo) => filas.reduce((t, f) => t + f[campo], 0);
  const faltante = redondear(suma("faltante"), 2);
  const sobrante = redondear(suma("sobrante"), 2);
  const registradas = suma("registradas");
  const resueltas = suma("resueltas");
  const pendientes = registradas - resueltas;
  return tarjeta({
    ...KPI7,
    valor: faltante,
    unidad: "Bs",
    sem: semaforoDiferencias({ faltante, pendientes, dias: filtros.dias }),
    detalle: `Sobrantes ${bs(sobrante)} · ${plural(pendientes, "pendiente", "pendientes")}`,
    datos: {
      faltante,
      sobrante,
      faltantes: suma("faltantes"),
      sobrantes: suma("sobrantes"),
      registradas,
      resueltas,
      pendientes,
      porcentaje_resueltas: porcentaje(resueltas, registradas),
      faltante_por_semana: redondear(faltante / Math.max(1, filtros.dias / 7), 2),
    },
    por_caja: filas.map((f) => ({
      caja_id: f.caja_id,
      faltante: redondear(f.faltante, 2),
      sobrante: redondear(f.sobrante, 2),
      registradas: f.registradas,
      resueltas: f.resueltas,
      pendientes: f.registradas - f.resueltas,
    })),
  });
}

/** GET /api/kpis/caja/diferencias */
async function diferencias(query) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularDiferencias(filtros) };
}

/** GET /api/kpis/caja/exactitud-arqueo */
async function exactitudArqueo(query) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularExactitudArqueo(filtros) };
}

/** GET /api/kpis/caja: las tarjetas de la pestaña "Caja" con los mismos filtros. */
async function pestanaCaja(query) {
  const filtros = await validarFiltros(query);
  const [exactitud, autorizacion, difs] = await Promise.all([
    calcularExactitudArqueo(filtros),
    calcularTiempoAutorizacion(filtros),
    calcularDiferencias(filtros),
  ]);
  return {
    filtros: filtrosPublicos(filtros),
    kpis: { exactitud_arqueo: exactitud, tiempo_autorizacion: autorizacion, diferencias_caja: difs },
  };
}

module.exports = {
  exactitudArqueo, tiempoAutorizacion, diferencias, pestanaCaja,
  calcularExactitudArqueo, calcularTiempoAutorizacion, calcularDiferencias, semaforoDiferencias, KPI3, KPI4, KPI7,
};
