const kpisRepo = require("../data/kpisRepo");
const {
  validarFiltros, filtrosPublicos, semaforoMayorEsMejor, porcentaje, plural, tarjeta,
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

/** GET /api/kpis/caja/exactitud-arqueo */
async function exactitudArqueo(query) {
  const filtros = await validarFiltros(query);
  return { filtros: filtrosPublicos(filtros), kpi: await calcularExactitudArqueo(filtros) };
}

/** GET /api/kpis/caja: las tarjetas de la pestaña "Caja" con los mismos filtros. */
async function pestanaCaja(query) {
  const filtros = await validarFiltros(query);
  return {
    filtros: filtrosPublicos(filtros),
    kpis: { exactitud_arqueo: await calcularExactitudArqueo(filtros) },
  };
}

module.exports = { exactitudArqueo, pestanaCaja, calcularExactitudArqueo, KPI3 };
