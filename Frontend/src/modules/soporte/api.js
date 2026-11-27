import { apiFetch } from '../../api/client.js'

// Apunta al microservicio Back/servicios/soporte (4007).
const SOPORTE_API_BASE_URL = import.meta.env.VITE_SOPORTE_API_BASE_URL ?? ''

// Las llamadas llevan el access_token del login de administración (administrador.access_token).
function conToken(token) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

// TDSI-1064: factura en solo lectura.
export function obtenerFactura(numero, token) {
  return apiFetch(`/api/soporte/facturas/${encodeURIComponent(numero)}`, conToken(token), SOPORTE_API_BASE_URL)
}

// TDSI-1066: transacción en solo lectura, con su historial (del cambio más nuevo al más antiguo).
export function obtenerTransaccion(id, token) {
  return apiFetch(`/api/soporte/transacciones/${encodeURIComponent(id)}`, conToken(token), SOPORTE_API_BASE_URL)
}

// TDSI-972: factura, transacción y sus diferencias. Sin transaccion, el backend usa la que guarda la factura.
// Responde data: { factura, transaccion | null, coincide, diferencias, avisos }.
export function compararFacturaYTransaccion({ factura, transaccion }, token) {
  const params = new URLSearchParams({ factura })
  if (transaccion) params.set('transaccion', transaccion)
  return apiFetch(`/api/soporte/comparacion?${params.toString()}`, conToken(token), SOPORTE_API_BASE_URL)
}

// Registra el hallazgo como incidente (POST /api/soporte/tickets, TDSI-668). Se usa solo con
// FEATURES.soporteIncidentes encendido. Quien lo registra sale de la sesión en el backend.
export function registrarIncidente(incidente, token) {
  return apiFetch(
    '/api/soporte/tickets',
    { method: 'POST', body: JSON.stringify(incidente), ...conToken(token) },
    SOPORTE_API_BASE_URL,
  )
}

// ---------- Bandeja de tickets (TDSI-66) ----------

// TDSI-671 y TDSI-674: bandeja paginada y ordenada por prioridad (Crítica primero), con filtros
// combinables { numero, usuario, desde, hasta, estado, prioridad }. Los filtros vacíos no se envían.
// Responde { data: [ticket], paginacion: { pagina, limite, total, paginas } }.
export function listarTickets({ pagina = 1, limite = 20, ...filtros } = {}, token) {
  const params = new URLSearchParams({ pagina: String(pagina), limite: String(limite) })
  for (const [clave, valor] of Object.entries(filtros)) {
    const limpio = typeof valor === 'string' ? valor.trim() : valor
    if (limpio) params.set(clave, limpio)
  }
  return apiFetch(`/api/soporte/tickets?${params.toString()}`, conToken(token), SOPORTE_API_BASE_URL)
}

// ---------- Historial por usuario (TDSI-66) ----------

// TDSI-209: usuarios que tienen incidentes, del último incidente al más antiguo (hasta 50).
// q filtra por parte del correo o del nombre. Responde data: [{ usuario, cantidad, ultimo_en }].
export function buscarUsuariosConIncidentes(q, token) {
  const params = new URLSearchParams()
  if (q?.trim()) params.set('q', q.trim())
  const consulta = params.toString()
  return apiFetch(
    `/api/soporte/historial/usuarios${consulta ? `?${consulta}` : ''}`,
    conToken(token),
    SOPORTE_API_BASE_URL,
  )
}

// TDSI-209: incidentes de un usuario, del más reciente al más antiguo, con fecha, estado y solución.
// Responde { data: [incidente], resumen: { usuario, total, abiertos, resueltos, mostrados } }.
export function obtenerHistorialUsuario(usuario, token) {
  const params = new URLSearchParams({ usuario })
  return apiFetch(`/api/soporte/historial?${params.toString()}`, conToken(token), SOPORTE_API_BASE_URL)
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

// ---------- Escalamiento (TDSI-65) ----------

// TDSI-207: escala el ticket al Administrador con un motivo (10 a 500 caracteres). Responde el
// ticket en Escalado; 409 si ya estaba escalado o si está Resuelto o Cerrado.
export function escalarTicket(numero, motivo, token) {
  return enviar(numero, '/escalar', 'POST', { motivo }, token)
}

// TDSI-1072: bandeja "Incidentes escalados" (solo el Administrador). Primero la mayor prioridad y,
// dentro de cada una, el que lleva más tiempo esperando. Responde { total, data: [ticket] } con
// motivo_escalamiento, escalado_por y escalado_en.
export function listarEscalados(token) {
  return apiFetch('/api/soporte/escalados', conToken(token), SOPORTE_API_BASE_URL)
}

// ---------- Reporte de incidencias (TDSI-67) ----------

// TDSI-211, 1074 y 1095: reporte del rango (fecha de creación, días de Bolivia, los dos incluidos;
// hasta 366 días). Responde data: { rango: { desde, hasta, dias }, total, por_estado, por_prioridad,
// tiempo_promedio_atencion: { incidentes_resueltos, promedio_minutos, texto }, problemas_frecuentes }.
export function obtenerReporteIncidentes({ desde, hasta }, token) {
  const params = new URLSearchParams()
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  return apiFetch(`/api/soporte/reportes/incidentes?${params.toString()}`, conToken(token), SOPORTE_API_BASE_URL)
}
