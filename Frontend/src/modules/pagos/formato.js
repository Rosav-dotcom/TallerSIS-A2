// Formatos del módulo Pagos (Sprint 4).
const VACIO = '—'
const MONTO = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const FECHA_HORA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' })
const FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' })

export const texto = (valor) => (valor === null || valor === undefined || valor === '' ? VACIO : valor)
export const monto = (valor) => (valor === null || valor === undefined ? VACIO : `Bs ${MONTO.format(valor)}`)
export const fechaHora = (valor) => (valor ? FECHA_HORA.format(new Date(valor)) : VACIO)
export const fecha = (valor) => (valor ? FECHA.format(new Date(valor)) : VACIO)

export function mensajeDeError(err) {
  if (err instanceof TypeError) return 'No se pudo conectar con el servicio de Pagos.'
  return err.message
}
