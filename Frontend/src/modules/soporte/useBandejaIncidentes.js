import { useCallback, useState } from 'react'
import useDebounce from '../../hooks/useDebounce.js'
import { listarTickets } from './api.js'
import { useCarga } from './useCarga.js'

export const TICKETS_POR_PAGINA = 20

// TDSI-675: filtros de la bandeja. Se combinan todos a la vez (TDSI-674).
export const SIN_FILTROS = { numero: '', usuario: '', desde: '', hasta: '', estado: '', prioridad: '' }
const RANGO_INVALIDO = 'La fecha final no puede ser anterior a la inicial.'

// TDSI-672: lógica de la bandeja "Incidentes": filtros, página actual y carga de los tickets.
// Al cambiar de página o de filtros, la tabla anterior sigue visible hasta que llega la nueva.
export function useBandejaIncidentes(token) {
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  // Número y usuario se escriben: se esperan 400 ms antes de buscar. Fechas, selectores y borrar, al instante.
  const numeroEscrito = useDebounce(filtros.numero)
  const usuarioEscrito = useDebounce(filtros.usuario)
  const numero = filtros.numero.trim() ? numeroEscrito : ''
  const usuario = filtros.usuario.trim() ? usuarioEscrito : ''
  const errorFechas = filtros.desde && filtros.hasta && filtros.desde > filtros.hasta ? RANGO_INVALIDO : null
  const aplicados = { ...filtros, numero: numero.trim(), usuario: usuario.trim() }
  const firma = JSON.stringify(aplicados)

  // La página y el ticket recién registrado (TDSI-669) valen para unos filtros: si cambian, se vuelve a la página 1.
  const [vista, setVista] = useState({ firma, pagina: 1, nuevo: null })
  const actual = vista.firma === firma ? vista : { firma, pagina: 1, nuevo: null }
  const { pagina, nuevo } = actual

  const cargar = useCallback(() => {
    // Con un rango de fechas imposible no se pregunta al backend: el error se muestra en el campo.
    if (errorFechas) return Promise.resolve({ data: null })
    return listarTickets({ ...JSON.parse(firma), pagina, limite: TICKETS_POR_PAGINA }, token).then(
      ({ data, paginacion }) => ({ data: { tickets: data, paginacion } }),
    )
  }, [firma, pagina, token, errorFechas])
  const { datos, cargando, error, recargar } = useCarga(cargar)

  const paginacion = datos?.paginacion
  const enPagina = datos?.tickets ?? []
  // El ticket nuevo se resalta y, si por su prioridad cae en otra página, se muestra arriba de la tabla.
  const tickets = nuevo && !enPagina.some((t) => t.numero === nuevo.numero) ? [nuevo, ...enPagina] : enPagina
  const hayFiltros = Object.values(filtros).some(Boolean)

  const irA = (nueva) => setVista({ firma, pagina: nueva, nuevo: null })

  return {
    filtros,
    cambiarFiltro: (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor })),
    limpiarFiltros: () => setFiltros(SIN_FILTROS),
    hayFiltros,
    errorFechas,
    tickets,
    nuevo,
    // Quita los filtros, vuelve a la primera página y recarga, para ver el ticket en la bandeja completa.
    registrado: (ticket) => {
      setFiltros(SIN_FILTROS)
      setVista({ firma: JSON.stringify(SIN_FILTROS), pagina: 1, nuevo: ticket })
      recargar()
    },
    olvidarNuevo: () => setVista({ ...actual, nuevo: null }),
    paginacion,
    cargando,
    error,
    recargar,
    pagina,
    hayAnterior: pagina > 1,
    haySiguiente: Boolean(paginacion) && pagina < paginacion.paginas,
    anterior: () => irA(Math.max(1, pagina - 1)),
    siguiente: () => irA(pagina + 1),
  }
}
