import { useState } from 'react'
import { registrarIncidente } from './api.js'
import { mensajeDeError } from './consultas.js'

function referenciaDe({ factura, transaccion }) {
  return factura
    ? { referencia_tipo: 'factura', referencia: factura.numero }
    : { referencia_tipo: 'transaccion', referencia: transaccion.id_transaccion }
}

// Descripción inicial con lo que se encontró; el Usuario de Soporte la puede cambiar.
function descripcionInicial({ factura, transaccion, comparacion }) {
  if (!comparacion || comparacion.coincide) return ''
  const pago = transaccion ? ` y el pago ${transaccion.id_transaccion}` : ''
  const lista = comparacion.diferencias.map((d) => `- ${d.mensaje}`).join('\n')
  return `Diferencias en la factura ${factura.numero}${pago}:\n${lista}`
}

// Formulario para guardar el hallazgo como incidente.
export function useRegistrarIncidente({ resultado, registradoPor, onRegistrado }) {
  const [tipo, setTipo] = useState(resultado.factura ? 'Facturacion' : 'Pagos')
  const [prioridad, setPrioridad] = useState('Media')
  const [descripcion, setDescripcion] = useState(() => descripcionInicial(resultado))
  const [errorDescripcion, setErrorDescripcion] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const referencia = referenciaDe(resultado)

  async function guardar(event) {
    event.preventDefault()
    if (!descripcion.trim()) {
      setErrorDescripcion('Describe el hallazgo.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const { data } = await registrarIncidente({
        tipo,
        prioridad,
        descripcion: descripcion.trim(),
        ...referencia,
        registrado_por: registradoPor,
      })
      onRegistrado(data)
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  return {
    tipo,
    setTipo,
    prioridad,
    setPrioridad,
    descripcion,
    cambiarDescripcion: (nueva) => {
      setDescripcion(nueva)
      setErrorDescripcion(null)
    },
    errorDescripcion,
    error,
    enviando,
    referencia,
    guardar,
  }
}
