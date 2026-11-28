const { AppError } = require("../utils/AppError");
const { construirFiltros, fecha, ZONA } = require("./ticketsService");
const { calcularReporte } = require("../domain/reporteIncidentes");

// TDSI-67: reporte de incidencias para el Usuario de Soporte.
// Rango por fecha de creación del incidente, en días de Bolivia, con los dos días incluidos.
// Sin fechas: los últimos 30 días (hasta hoy). Rango máximo: 366 días.
const DIAS_POR_DEFECTO = 30;
const DIAS_MAXIMOS = 366;
const DIA_MS = 24 * 60 * 60 * 1000;

/** "Hoy" en Bolivia como AAAA-MM-DD. */
const hoyEnBolivia = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONA });

const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10);
const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS) + 1;

/** Completa el rango: si falta un extremo se toman 30 días desde el otro. */
function resolverRango(consulta = {}, hoy) {
  let desde = fecha(consulta.desde, "desde");
  let hasta = fecha(consulta.hasta, "hasta");
  if (!hasta) hasta = desde ? sumarDias(desde, DIAS_POR_DEFECTO - 1) : hoy;
  if (!desde) desde = sumarDias(hasta, -(DIAS_POR_DEFECTO - 1));
  if (desde > hasta) throw new AppError("La fecha 'desde' no puede ser posterior a 'hasta'.", 400);
  const dias = diasEntre(desde, hasta);
  if (dias > DIAS_MAXIMOS) {
    throw new AppError(`El rango puede tener hasta ${DIAS_MAXIMOS} días (pidió ${dias}).`, 400, { desde, hasta });
  }
  return { desde, hasta, dias };
}

function crearReportesService({ repo, hoy = hoyEnBolivia }) {
  return {
    /** GET /api/soporte/reportes/incidentes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD */
    async reporteIncidentes(consulta = {}) {
      const rango = resolverRango(consulta, hoy());
      const { condiciones, params } = construirFiltros({ desde: rango.desde, hasta: rango.hasta });
      const filas = await repo.incidentesDelRango({ condiciones, params });
      return { rango, ...calcularReporte(filas) };
    },
  };
}

module.exports = { crearReportesService, resolverRango, DIAS_POR_DEFECTO, DIAS_MAXIMOS };
