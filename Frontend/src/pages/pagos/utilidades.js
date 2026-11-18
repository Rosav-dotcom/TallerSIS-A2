// Funciones del cobro (antes dentro de Pagos.jsx). Se movieron sin cambios.
import { listarMisFacturas } from '../../api/pagos.js'
import {
  EFECTIVO_USD,
  EMAIL_REGEX,
  MENSAJE_FORMATO_DOCUMENTO,
  MENSAJE_MONTO_INSUFICIENTE,
  REGEX_DOCUMENTO,
} from './constantes.js'

export function formatearTiempoRestante(segundos) {
  if (segundos == null) return null
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return `${minutos}:${String(resto).padStart(2, '0')}`
}

// El conteo se pide con la fecha local: sin fecha, el backend usa la fecha del servidor de la base,
// que en UTC ya cambia de dia a las 20:00 de Bolivia.
export function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// TDSI-831: datos del cobro que se esta por repetir. mis-facturas filtra por dia ("YYYY-MM-DD"):
// se pide desde ayer para no perderlo cerca de medianoche o por la zona horaria del servidor.
export async function buscarCobroAnterior(cajero, factura) {
  const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const desde = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`
  const { data } = await listarMisFacturas(cajero, { desde })
  return data.find((f) => f.id_transaccion === factura) ?? null
}

// TDSI-816: total de la venta en dolares. Se redondea hacia arriba al centavo para que
// el monto que se le pide al cliente siempre cubra el total (100 / 12 = 8.34, no 8.33).
export function totalEnDolares(totalBs, tipoCambio) {
  return Math.ceil((Math.round(totalBs * 100) * 100) / Math.round(tipoCambio * 100)) / 100
}

export function leyendaPagadoEnUsd(dolares, tipoCambio) {
  return `Pagado en USD: ${dolares.toFixed(2)} (T.C. ${tipoCambio})`
}

export function validarFormulario(datos) {
  if (!datos.monto || Number(datos.monto) <= 0) {
    return 'Ingrese un monto válido.'
  }
  if (datos.metodos.length === 0) {
    return 'Seleccione un método de pago.'
  }
  if (datos.metodos.length === 2) {
    const m1 = Number(datos.montoMixto1)
    const m2 = Number(datos.montoMixto2)
    if (!datos.montoMixto1 || !datos.montoMixto2 || m1 <= 0 || m2 <= 0) {
      return 'Complete el monto de cada método del pago mixto.'
    }
    if (Math.round((m1 + m2) * 100) !== Math.round(Number(datos.monto) * 100)) {
      return 'La suma de los montos del pago mixto debe ser igual al monto total.'
    }
  }
  // TDSI-29/548: en efectivo (pago simple) hay que saber cuánto dio el cliente,
  // y no puede ser menor al total (no se puede dar un vuelto negativo).
  if (datos.metodos.length === 1 && datos.metodos[0] === 'Efectivo') {
    if (!datos.montoRecibido || Number(datos.montoRecibido) <= 0) {
      return 'Ingrese cuánto dinero recibió del cliente.'
    }
    if (Number(datos.montoRecibido) < Number(datos.monto)) {
      return MENSAJE_MONTO_INSUFICIENTE
    }
  }
  if (datos.metodos[0] === EFECTIVO_USD && !(Number(datos.dolaresRecibidos) > 0)) {
    return 'Ingrese cuántos dólares recibió del cliente.'
  }
  if (datos.tipoDocumento !== 'NINGUNO') {
    if (!datos.numeroDocumento.trim() || !datos.razonSocial.trim()) {
      return `Complete el número de ${datos.tipoDocumento} y la razón social.`
    }
    if (!REGEX_DOCUMENTO[datos.tipoDocumento].test(datos.numeroDocumento.trim())) {
      return MENSAJE_FORMATO_DOCUMENTO[datos.tipoDocumento]
    }
  }
  if (datos.enviarCorreo === true && !EMAIL_REGEX.test(datos.email.trim())) {
    return 'Ingrese un correo válido para enviar la factura.'
  }
  return null
}
