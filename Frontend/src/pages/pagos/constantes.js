// Constantes del cobro (antes dentro de Pagos.jsx). Se movieron sin cambios.

export const MENSAJE_MONTO_INSUFICIENTE = 'El monto recibido es insuficiente: es menor al total a cobrar.'

// TDSI-162: opcion de la pantalla; se registra como metodo "Efectivo" con el monto en Bs.
export const EFECTIVO_USD = 'EfectivoUSD'

export const ESTADO_INICIAL = {
  monto: '',
  metodos: [], // 1 metodo = pago simple, 2 metodos = pago mixto
  montoMixto1: '',
  montoMixto2: '',
  montoRecibido: '', // TDSI-29/793: efectivo que dio el cliente (obligatorio en pago simple, opcional en mixto)
  dolaresRecibidos: '', // TDSI-817: solo aplica a "Efectivo en dólares"
  tipoDocumento: 'NINGUNO',
  numeroDocumento: '',
  razonSocial: '',
  telefono: '',
  enviarCorreo: null, // null = sin elegir, true/false = Si/No
  email: '',
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// En Bolivia el NIT tiene exactamente 10 dígitos; el CI tiene 7 u 8.
export const REGEX_DOCUMENTO = {
  NIT: /^\d{10}$/,
  CI: /^\d{7,8}$/,
}
export const MENSAJE_FORMATO_DOCUMENTO = {
  NIT: 'El NIT debe tener exactamente 10 dígitos.',
  CI: 'El CI debe tener entre 7 y 8 dígitos.',
}
