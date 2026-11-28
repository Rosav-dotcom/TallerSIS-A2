import { apiFetch } from '../../api/client.js'

// Tablero de KPIs (Sprint 4). Pestaña "Ventas" (TDSI-640): microservicio gestion_pagos (4005).
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// TDSI-650: KPI-1, 2, 5, 6 y 8 con su fórmula, semáforo y detalle ya calculados.
// filtros: { desde, hasta (AAAA-MM-DD), caja_id, cajero_id } (vacíos = mes en curso y todas las cajas).
// Responde data: { filtros, mes_anterior, kpis: { ticket_promedio, tasa_anulacion, mix_metodos,
// cumplimiento_meta, tasa_canceladas }, avisos }. Detalle: Back/servicios/gestion_pagos/docs/kpis-ventas.md
export function obtenerKpisVentas(filtros = {}) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) if (valor) params.set(clave, valor)
  const consulta = params.toString()
  return apiFetch(`/api/kpis/ventas${consulta ? `?${consulta}` : ''}`, {}, GESTION_PAGOS_API_BASE_URL)
}
