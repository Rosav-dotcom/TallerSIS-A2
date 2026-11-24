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
