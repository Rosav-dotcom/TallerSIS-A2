// Semáforo de los KPIs (las 3 pestañas usan los mismos estados y colores, tablero-kpis.md).
// El estado lo calcula el backend con los rangos de cada KPI; aquí solo se elige el tono del Chip.
const TONO = {
  'En meta': 'exito',
  Atención: 'advertencia',
  'Fuera de meta': 'error',
  Referencia: 'neutro',
  'Sin datos': 'neutro',
}

export const tonoSemaforo = (texto) => TONO[texto] ?? 'neutro'

const NUMERO = (decimales) =>
  new Intl.NumberFormat('es-BO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

// Montos en Bs con 2 decimales; porcentajes con 1 decimal (tablero-kpis.md, "Cada tarjeta").
export function valorKpi(valor, unidad) {
  if (valor === null || valor === undefined) return '—'
  if (unidad === 'Bs') return `Bs ${NUMERO(2).format(valor)}`
  if (unidad === '%') return `${NUMERO(1).format(valor)} %`
  return NUMERO(0).format(valor)
}
