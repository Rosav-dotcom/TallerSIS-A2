// Formatos y textos de las vistas de Soporte.

const VACIO = '—'
const MONTO = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' })

export const texto = (valor) => valor || VACIO
export const monto = (valor) => (valor === null || valor === undefined ? VACIO : `Bs ${MONTO.format(valor)}`)
export const fecha = (valor) => (valor ? FECHA.format(new Date(valor)) : VACIO)

const ESTADO_FACTURA = {
  Emitida: { texto: 'Emitida', tono: 'exito' },
  AnulacionSolicitada: { texto: 'Anulación solicitada', tono: 'advertencia' },
  Anulada: { texto: 'Anulada', tono: 'neutro' },
  Borrador: { texto: 'Borrador', tono: 'neutro' },
}

export function estadoFactura(estado) {
  return ESTADO_FACTURA[estado] ?? { texto: texto(estado), tono: 'neutro' }
}

const ESTADO_PAGO = {
  PENDIENTE: { texto: 'Pendiente', tono: 'advertencia' },
  APROBADA: { texto: 'Aprobada', tono: 'exito' },
  RECHAZADA: { texto: 'Rechazada', tono: 'error' },
}

const esRevertido = (estado) => /^revertid[oa]$/i.test(estado ?? '')

export function estadoPago(estado) {
  if (esRevertido(estado)) return { texto: 'Revertido', tono: 'info' }
  return ESTADO_PAGO[estado] ?? { texto: texto(estado), tono: 'neutro' }
}

// Chip del pago: Revertido y Anulado mandan sobre el resultado del cobro.
export function estadoTransaccion({ estado, estado_pago }) {
  if (esRevertido(estado) || esRevertido(estado_pago)) return estadoPago('Revertido')
  if (estado === 'Anulado') return { texto: 'Anulado', tono: 'neutro' }
  return estadoPago(estado_pago)
}

const CAMPO = {
  transaccion: 'Transacción',
  referencia: 'Referencia',
  total: 'Total',
  'cliente.nit': 'NIT/CI',
  'cliente.razon_social': 'Razón social',
  estado: 'Estado',
  estado_pago: 'Resultado del cobro',
}

const PREFIJO_METODO = 'metodo_pago.'

export function nombreCampo(campo) {
  if (campo.startsWith(PREFIJO_METODO)) return `Pago con ${campo.slice(PREFIJO_METODO.length)}`
  return CAMPO[campo] ?? campo
}

// Valor de una diferencia: los montos llegan como número, el resto como texto.
export function valorDiferencia(campo, valor) {
  if (typeof valor === 'number') return monto(valor)
  if (campo === 'estado_pago') return valor in ESTADO_PAGO ? ESTADO_PAGO[valor].texto : texto(valor)
  return texto(valor)
}
