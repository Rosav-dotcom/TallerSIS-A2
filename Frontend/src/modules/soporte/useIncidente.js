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
export function useIncidente(numero, usuario) {
  const ticket = useCarga(useCallback(() => obtenerTicket(numero), [numero]))
  const historial = useCarga(useCallback(() => obtenerHistorialTicket(numero), [numero]))
  const [guardando, setGuardando] = useState(false)
  const [errorCambio, setErrorCambio] = useState(null)

  // Guarda un cambio y deja en pantalla lo que devolvió el backend. Si falla, queda el valor anterior.
  async function guardar(pedido, cambio) {
    setGuardando(true)
    setErrorCambio(null)
    try {
      const { data } = await pedido
      ticket.setDatos((actual) => ({ ...actual, ...cambio, ...data }))
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
    cambiarTipo: (tipo) => guardar(cambiarTipoTicket(numero, { tipo, usuario }), { tipo }),
    cambiarPrioridad: (prioridad) => guardar(cambiarPrioridadTicket(numero, { prioridad, usuario }), { prioridad }),
    cambiarEstado: (estado) => guardar(cambiarEstadoTicket(numero, { estado, usuario }), { estado }),
    resolver: (solucion) => guardar(resolverTicket(numero, { solucion, usuario }), { solucion, estado: 'Resuelto' }),
  }
}
