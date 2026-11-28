import { apiFetch } from '../../api/client.js'

// Módulo Pagos del Sprint 4 (Equipo 2): apunta al microservicio Back/servicios/gestion_pagos (4005).
const GESTION_PAGOS_API_BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL ?? ''

// ---------- Comprobante de reembolso (TDSI-79) ----------
// Contrato: Back/servicios/gestion_pagos/docs/contrato-comprobantes.md

// TDSI-1121: envíos del comprobante de una devolución, del más nuevo al más antiguo.
// Cada envío: { id, tipo, devolucion_id, email, nota_credito, estado (Pendiente | Enviado | Error),
// simulado, intentos, ultimo_error, puede_reenviar, creado_en, enviado_en, comprobante }.
export function listarEnviosComprobante(devolucionId) {
  const params = new URLSearchParams({ devolucion_id: devolucionId })
  return apiFetch(`/api/pagos/comprobantes/envios?${params.toString()}`, {}, GESTION_PAGOS_API_BASE_URL)
}

// TDSI-1121: reenvía el comprobante. Con email, lo manda a ese correo corregido (TDSI-1123).
// Responde { mensaje, data: envío } con intentos + 1; 409 si ya se está enviando (dos clics).
export function reenviarComprobante(idEnvio, email) {
  return apiFetch(
    `/api/pagos/comprobantes/envios/${encodeURIComponent(idEnvio)}/reenviar`,
    { method: 'POST', body: JSON.stringify(email ? { email } : {}) },
    GESTION_PAGOS_API_BASE_URL,
  )
}
