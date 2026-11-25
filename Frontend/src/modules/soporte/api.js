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
