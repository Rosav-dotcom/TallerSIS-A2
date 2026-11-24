import { compararFacturaYTransaccion, obtenerFactura, obtenerTransaccion } from './api.js'

// Texto para mostrar de un error de la API. El detalle solo se agrega en los 400, donde explica el formato.
export function mensajeDeError(err) {
  if (err instanceof TypeError) return 'No se pudo conectar con el servicio de Soporte.'
  if (err.status === 400 && typeof err.detalle === 'string') return `${err.message}. ${err.detalle}`
  return err.message
}

// Compara las dos referencias. Se usa también para completar el lado que faltaba.
export async function comparar(numeroFactura, idTransaccion) {
  const { data } = await compararFacturaYTransaccion({ factura: numeroFactura, transaccion: idTransaccion })
  const { factura, transaccion, coincide, diferencias, avisos } = data
  return { factura, transaccion, comparacion: { coincide, diferencias, avisos }, errorPago: null }
}

// Busca por factura. Si la comparación no se puede hacer (la factura no indica su transacción o
// Gestión de pagos no responde), igual se muestra la factura sola.
async function buscarPorFactura(numero) {
  try {
    return await comparar(numero)
  } catch (err) {
    if (err.status === 404) throw err
    const { data: factura } = await obtenerFactura(numero)
    return { factura, transaccion: null, comparacion: null, errorPago: factura.venta_id ? err : null }
  }
}

// Busca por transacción. El backend no puede ir de la transacción a su factura: se muestra el pago
// y la factura se indica después.
async function buscarPorTransaccion(id) {
  const { data: transaccion } = await obtenerTransaccion(id)
  return { factura: null, transaccion, comparacion: null, errorPago: null }
}

export function buscar({ tipo, valor }) {
  return tipo === 'factura' ? buscarPorFactura(valor) : buscarPorTransaccion(valor)
}
