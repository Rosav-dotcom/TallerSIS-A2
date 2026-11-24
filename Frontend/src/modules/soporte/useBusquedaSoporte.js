import { useRef, useState } from 'react'
import { buscar, comparar, mensajeDeError } from './consultas.js'

const SIN_VALOR = {
  factura: 'Ingresa el número de factura.',
  transaccion: 'Ingresa el ID de transacción.',
}

// Lógica de la pantalla "Soporte": buscar por factura o transacción y comparar los dos lados.
export function useBusquedaSoporte() {
  const [tipo, setTipo] = useState('factura')
  const [valor, setValor] = useState('')
  const [errorCampo, setErrorCampo] = useState(null)

  const [ultima, setUltima] = useState(null) // última búsqueda hecha: { tipo, valor }
  const [resultado, setResultado] = useState(null) // { factura, transaccion, comparacion, errorPago }
  const [cargando, setCargando] = useState(false)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [error, setError] = useState(null)

  const [comparando, setComparando] = useState(false)
  const [errorVinculo, setErrorVinculo] = useState(null)

  // Solo vale la respuesta de la última búsqueda (una lenta no pisa a la siguiente).
  const turno = useRef(0)

  async function ejecutar(busqueda) {
    const actual = ++turno.current
    setUltima(busqueda)
    setResultado(null)
    setError(null)
    setNoEncontrado(false)
    setErrorCampo(null)
    setErrorVinculo(null)
    setComparando(false)
    setCargando(true)
    try {
      const encontrado = await buscar(busqueda)
      if (actual === turno.current) setResultado(encontrado)
    } catch (err) {
      if (actual !== turno.current) return
      if (err.status === 404) setNoEncontrado(true)
      else if (err.status === 400) setErrorCampo(mensajeDeError(err))
      else setError(mensajeDeError(err))
    } finally {
      if (actual === turno.current) setCargando(false)
    }
  }

  function enviar(event) {
    event.preventDefault()
    const limpio = valor.trim()
    if (!limpio) {
      setErrorCampo(SIN_VALOR[tipo])
      return
    }
    ejecutar({ tipo, valor: limpio })
  }

  // Completa el lado que faltaba (la transacción de la factura o la factura del pago) y compara.
  // Si falla, lo que ya se encontró sigue en pantalla.
  async function vincular(otro) {
    const limpio = otro.trim()
    const faltaFactura = !resultado.factura
    if (!limpio) {
      setErrorVinculo(SIN_VALOR[faltaFactura ? 'factura' : 'transaccion'])
      return
    }
    const actual = ++turno.current
    setComparando(true)
    setErrorVinculo(null)
    try {
      const completo = faltaFactura
        ? await comparar(limpio, resultado.transaccion.id_transaccion)
        : await comparar(resultado.factura.numero, limpio)
      if (actual === turno.current) setResultado(completo)
    } catch (err) {
      if (actual === turno.current) setErrorVinculo(mensajeDeError(err))
    } finally {
      if (actual === turno.current) setComparando(false)
    }
  }

  return {
    tipo,
    valor,
    errorCampo,
    cambiarTipo: (nuevo) => {
      setTipo(nuevo)
      setErrorCampo(null)
    },
    cambiarValor: (nuevo) => {
      setValor(nuevo)
      setErrorCampo(null)
    },
    enviar,
    reintentar: () => ejecutar(ultima),
    ultima,
    resultado,
    cargando,
    noEncontrado,
    error,
    comparando,
    errorVinculo,
    vincular,
  }
}
