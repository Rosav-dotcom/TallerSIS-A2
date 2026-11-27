import { compararFacturaYTransaccion, obtenerFactura, obtenerTransaccion } from './api.js'

// Texto para mostrar de un error de la API. El detalle solo se agrega en los 400, donde explica el formato.
export function mensajeDeError(err) {
  if (err instanceof TypeError) return 'No se pudo conectar con el servicio de Soporte.'
  if (err.status === 401) return 'Tu sesión venció. Cierra sesión e ingresa de nuevo.'
  if (err.status === 400 && typeof err.detalle === 'string') return `${err.message}. ${err.detalle}`
  return err.message
}

// Compara las dos referencias. Se usa también para completar el lado que faltaba.
export async function comparar(numeroFactura, idTransaccion, token) {
  const { data } = await compararFacturaYTransaccion({ factura: numeroFactura, transaccion: idTransaccion }, token)
  const { factura, transaccion, coincide, diferencias, avisos } = data
  return { factura, transaccion, comparacion: { coincide, diferencias, avisos }, errorPago: null }
}

// Busca por factura. Si la comparación no se puede hacer (la factura no indica su transacción o
// Gestión de pagos no responde), igual se muestra la factura sola.
async function buscarPorFactura(numero, token) {
  try {
    return await comparar(numero, null, token)
  } catch (err) {
    if (err.status === 404) throw err
    const { data: factura } = await obtenerFactura(numero, token)
    return { factura, transaccion: null, comparacion: null, errorPago: factura.venta_id ? err : null }
  }
}

// Busca por transacción. El backend no puede ir de la transacción a su factura: se muestra el pago
// y la factura se indica después.
async function buscarPorTransaccion(id, token) {
  const { data: transaccion } = await obtenerTransaccion(id, token)
  return { factura: null, transaccion, comparacion: null, errorPago: null }
}

export function buscar({ tipo, valor }, token) {
  return tipo === 'factura' ? buscarPorFactura(valor, token) : buscarPorTransaccion(valor, token)
}
