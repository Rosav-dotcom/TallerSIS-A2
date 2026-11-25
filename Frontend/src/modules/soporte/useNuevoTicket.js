import { useState } from 'react'
import { registrarIncidente } from './api.js'
import { mensajeDeError } from './consultas.js'

// Límites del formulario (Figma p.2: área de texto 0/300). El backend acepta lo mismo o más.
export const MAX_USUARIO = 100
export const MAX_REFERENCIA = 60
export const MAX_DESCRIPCION = 300
const FORMATO_REFERENCIA = /^[A-Za-z0-9_-]+$/

const VACIO = {
  usuario_afectado: '',
  tipo: 'Facturacion',
  prioridad: 'Media',
  referencia_tipo: '',
  referencia: '',
  descripcion: '',
}

function validar(campos) {
  const errores = {}
  if (!campos.usuario_afectado.trim()) errores.usuario_afectado = 'Ingresa el usuario afectado.'
  if (campos.referencia_tipo) {
    const referencia = campos.referencia.trim()
    if (!referencia) {
      errores.referencia =
        campos.referencia_tipo === 'factura' ? 'Ingresa el número de factura.' : 'Ingresa el ID de transacción.'
    } else if (!FORMATO_REFERENCIA.test(referencia)) {
      errores.referencia = 'Usa solo letras, números, guiones y guiones bajos.'
    }
  }
  if (!campos.descripcion.trim()) errores.descripcion = 'Describe el problema.'
  return errores
}

// Cuerpo de POST /api/soporte/tickets (TDSI-668). Quien lo registra sale de la sesión en el backend.
function cuerpo(campos) {
  const ticket = {
    usuario_afectado: campos.usuario_afectado.trim(),
    tipo: campos.tipo,
    prioridad: campos.prioridad,
    descripcion: campos.descripcion.trim(),
  }
  if (campos.referencia_tipo) {
    ticket.referencia_tipo = campos.referencia_tipo
    ticket.referencia = campos.referencia.trim()
  }
  return ticket
}

// TDSI-669: lógica del formulario "Nuevo ticket". El ticket nace Abierto con su número correlativo.
export function useNuevoTicket({ token, onRegistrado }) {
  const [campos, setCampos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  function cambiar(campo, valor) {
    setCampos((c) => {
      const nuevos = { ...c, [campo]: valor }
      // Sin tipo de referencia no hay número que guardar.
      if (campo === 'referencia_tipo' && !valor) nuevos.referencia = ''
      return nuevos
    })
    setErrores((e) => ({ ...e, [campo]: undefined, ...(campo === 'referencia_tipo' && { referencia: undefined }) }))
  }

  async function guardar(event) {
    event.preventDefault()
    if (enviando) return
    const encontrados = validar(campos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length > 0) return
    setEnviando(true)
    setError(null)
    try {
      const { data } = await registrarIncidente(cuerpo(campos), token)
      onRegistrado(data)
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  return { campos, cambiar, errores, error, enviando, guardar }
}
