const { AppError } = require("../utils/AppError");
const { hoyLocal, validarFechaDia } = require("../utils/fechaLocal");
const { validarCajaOpcional, validarCajeroOpcional } = require("./historialCajerosService");
const kpis = require("../domain/kpisVentas");

// TDSI-650 (TDSI-640): GET /api/kpis/ventas -- las 5 tarjetas de la pestaña "Ventas" del
// Tablero de KPIs con los filtros comunes Periodo, Caja y Cajero (los mismos de la pestaña
// "Caja", TDSI-639). Fórmulas en src/domain/kpisVentas.js; definición y validación en
// docs/kpis-ventas.md.

const MAX_DIAS = 366;
const DIA_MS = 24 * 60 * 60 * 1000;
const vacio = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim());
const inicioDeMes = (dia) => `${dia.slice(0, 8)}01`;
const diasEntre = (d, h) => Math.round((Date.parse(`${h}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / DIA_MS) + 1;

/** El mes calendario anterior al de "dia": 2026-11-10 -> { desde: 2026-10-01, hasta: 2026-10-31 }. */
function mesAnterior(dia) {
  const [a, m] = dia.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 2, 1));
  const ultimo = new Date(Date.UTC(a, m - 1, 0));
  return { desde: primero.toISOString().slice(0, 10), hasta: ultimo.toISOString().slice(0, 10) };
}

/**
 * Filtros del tablero: desde y hasta (YYYY-MM-DD, días de Bolivia, inclusive; por defecto el
 * mes en curso hasta hoy; con uno solo, desde el inicio de ese mes o hasta hoy), caja_id y
 * cajero_id opcionales. Máximo 366 días.
 */
function validarFiltros({ desde, hasta, caja_id, cajero_id } = {}, hoy = hoyLocal()) {
  for (const [campo, v] of Object.entries({ desde, hasta, caja_id, cajero_id })) {
    if (Array.isArray(v)) throw new AppError(`El filtro '${campo}' debe enviarse una sola vez.`, 400);
  }
  const desdeDado = vacio(desde) ? null : validarFechaDia(String(desde).trim(), "desde");
  const hastaDado = vacio(hasta) ? null : validarFechaDia(String(hasta).trim(), "hasta");
  const h = hastaDado || (desdeDado && desdeDado > hoy ? desdeDado : hoy);
  const d = desdeDado || inicioDeMes(h);
  if (d > h) throw new AppError("La fecha 'desde' no puede ser posterior a 'hasta'.", 400, { desde: d, hasta: h });
  const dias = diasEntre(d, h);
  if (dias > MAX_DIAS) throw new AppError(`El periodo puede ser de hasta ${MAX_DIAS} días.`, 400, { desde: d, hasta: h });
  return {
    desde: d,
    hasta: h,
    dias,
    cajaId: validarCajaOpcional(vacio(caja_id) ? null : String(caja_id)),
    cajeroId: validarCajeroOpcional(vacio(cajero_id) ? null : String(cajero_id)),
  };
}

const sumar = (lista, campo) => lista.reduce((t, x) => t + x[campo], 0);

function crearKpisVentasService({ repo = require("../data/kpisVentasRepo"), metas = require("./metasCajaProxy"), hoy = hoyLocal } = {}) {
  /** KPI-6 nunca tumba la pestaña: si Gestión de caja falla, la tarjeta queda "Sin datos". */
  async function leerMetas(fecha, cajaId) {
    try {
      const cajas = await metas.obtenerMetasDelDia(fecha);
      return { fecha, cajas: cajaId ? cajas.filter((c) => c.caja_id === cajaId) : cajas };
    } catch (e) {
      return { fecha, cajas: [], error: e.message };
    }
  }

  return {
    async kpisVentas(consulta = {}) {
      const filtros = validarFiltros(consulta, hoy());
      const anterior = { ...filtros, ...mesAnterior(filtros.desde) };

      const [porDia, porDiaAnterior, porCajero, metodos, metodosAnterior, canceladas, metasDia] = await Promise.all([
        repo.ventasCobradasPorDia(filtros),
        repo.ventasCobradasPorDia(anterior),
        repo.anulacionPorCajero(filtros),
        repo.montosPorMetodo(filtros),
        repo.montosPorMetodo(anterior),
        repo.canceladasPorMotivo(filtros),
        leerMetas(filtros.hasta, filtros.cajaId),
      ]);

      const actual = { cantidad: sumar(porDia, "cantidad"), monto: sumar(porDia, "monto") };
      const avisos = [];
      if (filtros.cajeroId) avisos.push("KPI-6 se calcula por caja: el filtro de cajero no se aplica a las metas de venta.");

      return {
        filtros: { desde: filtros.desde, hasta: filtros.hasta, caja_id: filtros.cajaId, cajero_id: filtros.cajeroId },
        mes_anterior: { desde: anterior.desde, hasta: anterior.hasta },
        kpis: {
          ticket_promedio: kpis.calcularTicketPromedio({
            actual,
            anterior: { cantidad: sumar(porDiaAnterior, "cantidad"), monto: sumar(porDiaAnterior, "monto") },
            porDia,
          }),
          tasa_anulacion: kpis.calcularTasaAnulacion({ porCajero }),
          mix_metodos: kpis.calcularMixMetodos({ actual: metodos, anterior: metodosAnterior }),
          cumplimiento_meta: kpis.calcularCumplimientoMeta(metasDia),
          tasa_canceladas: kpis.calcularTasaCanceladas({ canceladas, cobradas: actual.cantidad }),
        },
        avisos,
      };
    },
  };
}

module.exports = { crearKpisVentasService, validarFiltros, mesAnterior, MAX_DIAS };
