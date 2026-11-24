import { useCallback, useState } from 'react'
import { comentarTicket, listarComentariosTicket } from './api.js'
import { mensajeDeError } from './consultas.js'
import { useCarga } from './useCarga.js'

// Comentarios de un incidente: listar y agregar. No se editan ni se borran.
export function useComentarios(numero, autor) {
  const lista = useCarga(useCallback(() => listarComentariosTicket(numero), [numero]))
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)

  async function comentar(event) {
    event.preventDefault()
    const limpio = texto.trim()
    if (!limpio) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const { data } = await comentarTicket(numero, { texto: limpio, autor })
      lista.setDatos((actuales) => [...(actuales ?? []), data])
      setTexto('')
    } catch (err) {
      setErrorEnvio(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return { lista, texto, setTexto, enviando, errorEnvio, comentar }
}
