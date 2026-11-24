import { apiFetch } from '../../api/client.js'

const BASE = import.meta.env.VITE_DEVOLUCIONES_API_BASE_URL || 'http://localhost:4008'

// GET ?q=... devuelve {ok:true,data:{criterio,comprobante}} o {criterio,compras}.
export async function buscarComprobantes(consulta) {
  return apiFetch(`/api/devoluciones/comprobantes?q=${encodeURIComponent(consulta.trim())}`, {}, BASE)
}

// GET /:numero devuelve {ok:true,data:comprobante}.
export async function obtenerComprobante(numero) {
  return apiFetch(`/api/devoluciones/comprobantes/${encodeURIComponent(numero)}`, {}, BASE)
}
