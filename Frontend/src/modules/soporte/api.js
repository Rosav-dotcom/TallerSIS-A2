import { apiFetch } from '../../api/client.js'

// Apunta al microservicio Back/servicios/soporte (4007).
const SOPORTE_API_BASE_URL = import.meta.env.VITE_SOPORTE_API_BASE_URL ?? ''

// TDSI-1064: factura en solo lectura.
export function obtenerFactura(numero) {
  return apiFetch(`/api/soporte/facturas/${encodeURIComponent(numero)}`, {}, SOPORTE_API_BASE_URL)
}

// TDSI-1066: transacción en solo lectura, con su historial (del cambio más nuevo al más antiguo).
export function obtenerTransaccion(id) {
  return apiFetch(`/api/soporte/transacciones/${encodeURIComponent(id)}`, {}, SOPORTE_API_BASE_URL)
}

// TDSI-972: factura, transacción y sus diferencias. Sin transaccion, el backend usa la que guarda la factura.
// Responde data: { factura, transaccion | null, coincide, diferencias, avisos }.
export function compararFacturaYTransaccion({ factura, transaccion }) {
  const params = new URLSearchParams({ factura })
  if (transaccion) params.set('transaccion', transaccion)
  return apiFetch(`/api/soporte/comparacion?${params.toString()}`, {}, SOPORTE_API_BASE_URL)
}

// Registra el hallazgo como incidente. El endpoint todavía no existe (POST /api/soporte/tickets, TDSI-668):
// se usa solo con FEATURES.soporteIncidentes encendido. Los campos son los de la tabla soporte.incidentes
// (TDSI-971); si el endpoint los pide distintos, se ajusta en useRegistrarIncidente.js.
export function registrarIncidente(incidente) {
  return apiFetch('/api/soporte/tickets', { method: 'POST', body: JSON.stringify(incidente) }, SOPORTE_API_BASE_URL)
}

// ---------- Detalle del incidente (TDSI-64) ----------
// Estos endpoints todavía no existen: se usan solo con FEATURES.soporteDetalle encendido. Las rutas siguen
// la guía (/api/soporte/tickets) y los campos, la tabla soporte.incidentes. Si el backend los define
// distintos, se ajusta aquí.

const rutaTicket = (numero) => `/api/soporte/tickets/${encodeURIComponent(numero)}`

function enviar(ruta, method, cuerpo) {
  return apiFetch(ruta, { method, body: JSON.stringify(cuerpo) }, SOPORTE_API_BASE_URL)
}

// data: { numero, tipo, prioridad, estado, descripcion, referencia, usuario_afectado, registrado_por, creado_en,
//         solucion, solucion_registrada_por, resuelto_en }
export function obtenerTicket(numero) {
  return apiFetch(rutaTicket(numero), {}, SOPORTE_API_BASE_URL)
}

// TDSI-693: cambios de estado. data: [{ id, estado_nuevo, usuario, cambiado_en }]
export function obtenerHistorialTicket(numero) {
  return apiFetch(`${rutaTicket(numero)}/historial`, {}, SOPORTE_API_BASE_URL)
}

// Los cambios responden data con los campos actualizados del ticket.
// TDSI-677
export function cambiarTipoTicket(numero, { tipo, usuario }) {
  return enviar(`${rutaTicket(numero)}/tipo`, 'PATCH', { tipo, usuario })
}

// TDSI-680
export function cambiarPrioridadTicket(numero, { prioridad, usuario }) {
  return enviar(`${rutaTicket(numero)}/prioridad`, 'PATCH', { prioridad, usuario })
}

// TDSI-693
export function cambiarEstadoTicket(numero, { estado, usuario }) {
  return enviar(`${rutaTicket(numero)}/estado`, 'PATCH', { estado, usuario })
}

// TDSI-205: registra la solución y deja el incidente como Resuelto.
export function resolverTicket(numero, { solucion, usuario }) {
  return enviar(`${rutaTicket(numero)}/solucion`, 'POST', { solucion, usuario })
}

// TDSI-968: data: [{ id, autor, texto, creado_en }], del más antiguo al más nuevo.
export function listarComentariosTicket(numero) {
  return apiFetch(`${rutaTicket(numero)}/comentarios`, {}, SOPORTE_API_BASE_URL)
}

// TDSI-968: responde data con el comentario guardado.
export function comentarTicket(numero, { texto, autor }) {
  return enviar(`${rutaTicket(numero)}/comentarios`, 'POST', { texto, autor })
}
