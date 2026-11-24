const { query } = require("../config/db");
const { hoyLocal, validarDia } = require("../utils/fechas");
const { obtenerDevolucionesDelDia } = require("./devolucionesProxy");

const SIN_CAJA = "Sin caja";
const aCentavos = (v) => Math.round(Number(v) * 100);
const aMonto = (c) => c / 100;

/**
 * GET /api/caja/devoluciones?fecha=AAAA-MM-DD -- TDSI-80/1069: devoluciones del dia agrupadas por
 * caja (PA TDSI-1071) para la pestana "Devoluciones" del Tablero de ingresos: por caja, cuantas,
 * el monto reintegrado, el total por metodo de reembolso y quien autorizo cada una. Lee
 * Devoluciones por HTTP; los nombres de las cajas salen de caja.cajas. Sin las RECHAZADAS.
 */
async function resumenDevolucionesDelDia({ fecha } = {}) {
  const dia = fecha === undefined || fecha === "" ? hoyLocal() : validarDia(String(fecha), "fecha");
  const { devoluciones } = await obtenerDevolucionesDelDia(dia);

  const codigos = [...new Set(devoluciones.map((d) => d.caja_id).filter(Boolean))];
  const nombres = new Map();
  if (codigos.length) {
    const { rows } = await query("SELECT codigo, nombre FROM caja.cajas WHERE codigo = ANY($1)", [codigos]);
    for (const r of rows) nombres.set(r.codigo, r.nombre);
  }

  const porCaja = new Map();
  for (const d of devoluciones) {
    const clave = d.caja_id || null;
    if (!porCaja.has(clave)) {
      porCaja.set(clave, {
        caja_id: clave,
        caja_nombre: clave ? nombres.get(clave) || clave : SIN_CAJA,
        cantidad: 0,
        _montoC: 0,
        _metodos: new Map(),
        devoluciones: [],
      });
    }
    const caja = porCaja.get(clave);
    const metodo = d.opcion_reembolso ? d.opcion_reembolso.nombre : "Sin definir";
    caja.cantidad += 1;
    caja._montoC += aCentavos(d.monto_total);
    caja._metodos.set(metodo, (caja._metodos.get(metodo) || 0) + aCentavos(d.monto_total));
    caja.devoluciones.push({
      codigo: d.codigo,
      fecha: d.fecha,
      estado: d.estado,
      monto: d.monto_total,
      metodo,
      autorizado_por: d.autorizado_por ? { supervisor_id: d.autorizado_por, nombre: d.autorizado_por_nombre } : null,
    });
  }

  // Cajas por codigo; "Sin caja" al final
  const cajas = [...porCaja.values()]
    .sort((a, b) => (a.caja_id === null) - (b.caja_id === null) || String(a.caja_id).localeCompare(String(b.caja_id)))
    .map(({ _montoC, _metodos, ...c }) => ({
      ...c,
      monto_total: aMonto(_montoC),
      por_metodo: [..._metodos.entries()].map(([metodo, c2]) => ({ metodo, monto: aMonto(c2) })),
    }));

  return {
    fecha: dia,
    total_devoluciones: devoluciones.length,
    monto_total: aMonto(cajas.reduce((acc, c) => acc + aCentavos(c.monto_total), 0)),
    cajas,
  };
}

module.exports = { resumenDevolucionesDelDia, SIN_CAJA };
