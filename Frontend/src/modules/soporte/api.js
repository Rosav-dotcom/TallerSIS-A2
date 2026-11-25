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
// Piden el access_token del login de administración (administrador.access_token). Quien hace cada cambio
// sale de esa sesión en el backend (TDSI-665), por eso no se envía.

function pedirTicket(numero, subruta, token, options = {}) {
  return apiFetch(
    `/api/soporte/tickets/${encodeURIComponent(numero)}${subruta}`,
    { ...options, headers: { Authorization: `Bearer ${token}` } },
    SOPORTE_API_BASE_URL,
  )
}

function enviar(numero, subruta, method, cuerpo, token) {
  return pedirTicket(numero, subruta, token, { method, body: JSON.stringify(cuerpo) })
}

// TDSI-677: data: { numero, tipo, prioridad, estado, descripcion, referencia, usuario_afectado, registrado_por,
// creado_en, solucion, solucion_registrada_por, resuelto_en }. Los cambios responden el ticket actualizado.
export function obtenerTicket(numero, token) {
  return pedirTicket(numero, '', token)
}

// TDSI-693: cambios de estado, del más antiguo al más nuevo: [{ id, estado_anterior, estado_nuevo, usuario, cambiado_en }]
export function obtenerHistorialTicket(numero, token) {
  return pedirTicket(numero, '/historial', token)
}

// TDSI-677
export function cambiarTipoTicket(numero, tipo, token) {
  return enviar(numero, '/tipo', 'PATCH', { tipo }, token)
}

// TDSI-680
export function cambiarPrioridadTicket(numero, prioridad, token) {
  return enviar(numero, '/prioridad', 'PATCH', { prioridad }, token)
}

// TDSI-693: 409 con el motivo si la transición no se permite.
export function cambiarEstadoTicket(numero, estado, token) {
  return enviar(numero, '/estado', 'PATCH', { estado }, token)
}

// TDSI-205: registra la solución y deja el ticket en Resuelto.
export function resolverTicket(numero, solucion, token) {
  return enviar(numero, '/solucion', 'POST', { solucion }, token)
}

// TDSI-968: del más antiguo al más nuevo: [{ id, autor, texto, creado_en }]
export function listarComentariosTicket(numero, token) {
  return pedirTicket(numero, '/comentarios', token)
}

// TDSI-968: responde data con el comentario guardado.
export function comentarTicket(numero, texto, token) {
  return enviar(numero, '/comentarios', 'POST', { texto }, token)
}
