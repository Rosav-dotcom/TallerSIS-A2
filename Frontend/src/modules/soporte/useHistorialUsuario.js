import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import useDebounce from '../../hooks/useDebounce.js'
import { buscarUsuariosConIncidentes, obtenerHistorialUsuario } from './api.js'
import { useCarga } from './useCarga.js'

const NADA = () => Promise.resolve({ data: null })

// TDSI-210: lógica de "Historial por usuario". El usuario elegido va en la dirección
// (/soporte/historial?usuario=...), así se puede abrir desde la bandeja o compartir.
export function useHistorialUsuario(token) {
  const [params, setParams] = useSearchParams()
  const usuario = params.get('usuario')?.trim() || null

  // Buscador de usuarios: solo se usa mientras no hay un usuario elegido.
  const [busqueda, setBusqueda] = useState('')
  const escrita = useDebounce(busqueda)
  const q = busqueda.trim() ? escrita.trim() : ''
  const cargarUsuarios = useCallback(
    () => (usuario ? NADA() : buscarUsuariosConIncidentes(q, token)),
    [usuario, q, token],
  )
  const usuarios = useCarga(cargarUsuarios)

  const cargarHistorial = useCallback(
    () =>
      usuario
        ? obtenerHistorialUsuario(usuario, token).then(({ data, resumen }) => ({ data: { incidentes: data, resumen } }))
        : NADA(),
    [usuario, token],
  )
  const historial = useCarga(cargarHistorial)

  return {
    usuario,
    elegir: (elegido) => setParams({ usuario: elegido }),
    cambiarUsuario: () => setParams({}),
    busqueda,
    setBusqueda,
    usuarios,
    historial,
  }
}
