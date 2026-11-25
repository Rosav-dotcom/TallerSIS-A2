import { useCallback, useState } from 'react'
import { listarTickets } from './api.js'
import { useCarga } from './useCarga.js'

export const TICKETS_POR_PAGINA = 20

// TDSI-672: lógica de la bandeja "Incidentes": página actual y carga de los tickets.
// Al cambiar de página, la tabla anterior sigue visible hasta que llega la nueva.
export function useBandejaIncidentes(token) {
  const [pagina, setPagina] = useState(1)

  const cargar = useCallback(
    () =>
      listarTickets({ pagina, limite: TICKETS_POR_PAGINA }, token).then(({ data, paginacion }) => ({
        data: { tickets: data, paginacion },
      })),
    [pagina, token],
  )
  const { datos, cargando, error, recargar } = useCarga(cargar)

  const paginacion = datos?.paginacion
  return {
    tickets: datos?.tickets ?? [],
    paginacion,
    cargando,
    error,
    recargar,
    pagina,
    hayAnterior: pagina > 1,
    haySiguiente: Boolean(paginacion) && pagina < paginacion.paginas,
    anterior: () => setPagina((p) => Math.max(1, p - 1)),
    siguiente: () => setPagina((p) => p + 1),
  }
}
