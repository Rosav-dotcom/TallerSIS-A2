import { useCallback, useState } from 'react'
import {
  cambiarEstadoTicket,
  cambiarPrioridadTicket,
  cambiarTipoTicket,
  obtenerHistorialTicket,
  obtenerTicket,
  resolverTicket,
} from './api.js'
import { mensajeDeError } from './consultas.js'
import { useCarga } from './useCarga.js'

// Lógica del detalle de un incidente: sus datos, los cambios de tipo, prioridad y estado,
// la solución y el historial.
export function useIncidente(numero, token) {
  const ticket = useCarga(useCallback(() => obtenerTicket(numero, token), [numero, token]))
  const historial = useCarga(useCallback(() => obtenerHistorialTicket(numero, token), [numero, token]))
  const [guardando, setGuardando] = useState(false)
  const [errorCambio, setErrorCambio] = useState(null)

  // Guarda un cambio y deja en pantalla el ticket que devolvió el backend. Si falla, queda el valor anterior.
  async function guardar(pedido) {
    setGuardando(true)
    setErrorCambio(null)
    try {
      const { data } = await pedido
      ticket.setDatos(data)
      historial.recargar()
      return true
    } catch (err) {
      setErrorCambio(mensajeDeError(err))
      return false
    } finally {
      setGuardando(false)
    }
  }

  return {
    ticket,
    historial,
    guardando,
    errorCambio,
    cambiarTipo: (tipo) => guardar(cambiarTipoTicket(numero, tipo, token)),
    cambiarPrioridad: (prioridad) => guardar(cambiarPrioridadTicket(numero, prioridad, token)),
    cambiarEstado: (estado) => guardar(cambiarEstadoTicket(numero, estado, token)),
    resolver: (solucion) => guardar(resolverTicket(numero, solucion, token)),
  }
}
