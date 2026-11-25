import { useCallback, useState } from 'react'
import { listarTickets } from './api.js'
import { useCarga } from './useCarga.js'

export const TICKETS_POR_PAGINA = 20

// TDSI-672: lógica de la bandeja "Incidentes": página actual y carga de los tickets.
// Al cambiar de página, la tabla anterior sigue visible hasta que llega la nueva.
export function useBandejaIncidentes(token) {
  const [pagina, setPagina] = useState(1)
  // TDSI-669: último ticket registrado desde la bandeja. Se resalta y, si por su prioridad cae en
  // otra página, se muestra arriba de la tabla para que siempre se vea con su número y estado.
  const [nuevo, setNuevo] = useState(null)

  const cargar = useCallback(
    () =>
      listarTickets({ pagina, limite: TICKETS_POR_PAGINA }, token).then(({ data, paginacion }) => ({
        data: { tickets: data, paginacion },
      })),
    [pagina, token],
  )
  const { datos, cargando, error, recargar } = useCarga(cargar)

  const paginacion = datos?.paginacion
  const enPagina = datos?.tickets ?? []
  const tickets = nuevo && !enPagina.some((t) => t.numero === nuevo.numero) ? [nuevo, ...enPagina] : enPagina

  return {
    tickets,
    nuevo,
    // Vuelve a la primera página y recarga, para ver el ticket en su lugar de la bandeja.
    registrado: (ticket) => {
      setNuevo(ticket)
      setPagina(1)
      recargar()
    },
    olvidarNuevo: () => setNuevo(null),
    paginacion,
    cargando,
    error,
    recargar,
    pagina,
    hayAnterior: pagina > 1,
    haySiguiente: Boolean(paginacion) && pagina < paginacion.paginas,
    anterior: () => {
      setNuevo(null)
      setPagina((p) => Math.max(1, p - 1))
    },
    siguiente: () => {
      setNuevo(null)
      setPagina((p) => p + 1)
    },
  }
}
