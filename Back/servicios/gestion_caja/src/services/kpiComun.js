const { AppError } = require("../utils/AppError");
const cajasRepo = require("../data/cajasRepo");
const { ZONA, hoyLocal, validarDia, limitesDelRango } = require("../utils/fechas");

// TDSI-639: lo comun a los KPIs del tablero del Administrador (pestañas "Caja" y "Devoluciones
// y soporte"): filtros Periodo, Caja y Cajero, el semaforo y el formato de cada tarjeta.
// Nombres, formulas y metas son los de la presentacion "Tablero de KPIs de RePay"
// (Frontend/docs/pantallas/sprint4/tablero-kpis.md): se copian igual en la pantalla.

const MAX_DIAS = 366;
const UN_DIA_MS = 24 * 60 * 60 * 1000;
const vacio = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());

/** Primer dia del mes de una fecha "YYYY-MM-DD". */
const inicioDeMes = (dia) => `${dia.slice(0, 8)}01`;

/**
 * Filtros comunes del tablero (query string): desde y hasta (YYYY-MM-DD, dias de Bolivia,
 * inclusive; por defecto el mes en curso hasta hoy), caja_id y cajero_id (opcionales).
 * Devuelve tambien los instantes inicio y fin del periodo y su largo en dias.
 */
async function validarFiltros({ desde, hasta, caja_id: cajaId, cajero_id: cajeroId } = {}) {
  const hoy = hoyLocal();
  const d = vacio(desde) ? (vacio(hasta) ? inicioDeMes(hoy) : inicioDeMes(String(hasta).trim())) : String(desde).trim();
  const h = vacio(hasta) ? (vacio(desde) ? hoy : d > hoy ? d : hoy) : String(hasta).trim();
  validarDia(d, "desde");
  validarDia(h, "hasta");
  if (d > h) throw new AppError("'desde' no puede ser mayor que 'hasta'", 400, { desde, hasta });
  const { inicio, fin } = limitesDelRango(d, h);
  const dias = Math.round((fin - inicio) / UN_DIA_MS);
  if (dias > MAX_DIAS) throw new AppError(`El periodo puede ser de hasta ${MAX_DIAS} dias`, 400, { desde, hasta });

  const filtros = { desde: d, hasta: h, inicio, fin, dias, caja_id: null, cajero_id: null };
  if (!vacio(cajaId)) {
    filtros.caja_id = String(cajaId).trim();
    if (!(await cajasRepo.buscarPorCodigo(filtros.caja_id))) {
      throw new AppError(`La caja "${filtros.caja_id}" no existe`, 404, { caja_id: filtros.caja_id });
    }
  }
  if (!vacio(cajeroId)) filtros.cajero_id = String(cajeroId).trim();
  return filtros;
}

/** Filtros tal como se devuelven (sin los instantes internos). */
const filtrosPublicos = (f) => ({ desde: f.desde, hasta: f.hasta, caja_id: f.caja_id, cajero_id: f.cajero_id });

// ---------- semaforo ----------
const SEMAFORO = {
  EN_META: "En meta",
  ATENCION: "Atención",
  FUERA_DE_META: "Fuera de meta",
  SIN_DATOS: "Sin datos",
};
const semaforo = (estado) => ({ estado, texto: SEMAFORO[estado] });

/** Valor donde mas es mejor: >= meta En meta, >= atencion Atencion, si no Fuera de meta. */
function semaforoMayorEsMejor(valor, { meta, atencion }) {
  if (valor === null || valor === undefined) return semaforo("SIN_DATOS");
  if (valor >= meta) return semaforo("EN_META");
  return semaforo(valor >= atencion ? "ATENCION" : "FUERA_DE_META");
}

/** Valor donde menos es mejor: <= meta En meta, <= atencion Atencion, si no Fuera de meta. */
function semaforoMenorEsMejor(valor, { meta, atencion }) {
  if (valor === null || valor === undefined) return semaforo("SIN_DATOS");
  if (valor <= meta) return semaforo("EN_META");
  return semaforo(valor <= atencion ? "ATENCION" : "FUERA_DE_META");
}

// ---------- formato ----------
const redondear = (n, decimales = 1) => (n === null || n === undefined ? null : Number(Number(n).toFixed(decimales)));
const porcentaje = (parte, total) => (total > 0 ? redondear((parte / total) * 100, 1) : null);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const bs = (monto) =>
  `Bs ${new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto || 0)}`;

/** Tarjeta de un KPI: siempre con su formula exacta y su meta (boton "Formula"). */
function tarjeta({ kpi, nombre, formula, meta, valor, unidad, sem, detalle, ...resto }) {
  return { kpi, nombre, formula, meta, valor, unidad, semaforo: sem, detalle, ...resto };
}

module.exports = {
  ZONA, MAX_DIAS, validarFiltros, filtrosPublicos, semaforo, semaforoMayorEsMejor, semaforoMenorEsMejor,
  redondear, porcentaje, plural, bs, tarjeta,
};
