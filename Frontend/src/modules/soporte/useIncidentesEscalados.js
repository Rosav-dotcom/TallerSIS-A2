import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cambiarEstadoTicket, listarEscalados } from './api.js'
import { mensajeDeError } from './consultas.js'
import { useCarga } from './useCarga.js'

// TDSI-1073: lógica de la bandeja "Incidentes escalados" del Administrador.
// "Tomar y resolver" pasa el ticket a En proceso (Escalado → En proceso, TDSI-693) y abre su
// detalle, donde el Administrador registra la solución.
export function useIncidentesEscalados(token) {
  const navigate = useNavigate()
  const escalados = useCarga(useCallback(() => listarEscalados(token), [token]))
  const [tomando, setTomando] = useState(null) // número del ticket que se está tomando
  const [errorTomar, setErrorTomar] = useState(null)

  async function tomar(numero) {
    setTomando(numero)
    setErrorTomar(null)
    try {
      await cambiarEstadoTicket(numero, 'En proceso', token)
      navigate(`/admin/soporte/incidentes/${encodeURIComponent(numero)}`)
    } catch (err) {
      setErrorTomar(`No se pudo tomar ${numero}: ${mensajeDeError(err)}`)
      setTomando(null)
      escalados.recargar()
    }
  }

  return { escalados, tomando, errorTomar, tomar }
}
