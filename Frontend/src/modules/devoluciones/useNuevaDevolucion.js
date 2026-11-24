import { useCallback, useRef, useState } from 'react'
import { buscarComprobantes, obtenerComprobante } from './api.js'

const MENSAJE_NO_ENCONTRADO = 'Comprobante no encontrado o anulado'

export default function useNuevaDevolucion() {
  const [consulta, setConsulta] = useState('')
  const [comprobante, setComprobante] = useState(null)
  const [compras, setCompras] = useState([])
  const [criterio, setCriterio] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [ultimaAccion, setUltimaAccion] = useState(null)
  const version = useRef(0)

  const ejecutar = useCallback(async (accion, valor) => {
    const actual = ++version.current
    setCargando(true)
    setError('')
    setComprobante(null)
    setCompras([])
    setCriterio(null)
    setUltimaAccion({ accion, valor })
    try {
      const respuesta = accion === 'detalle' ? await obtenerComprobante(valor) : await buscarComprobantes(valor)
      if (actual !== version.current) return
      if (accion === 'detalle') {
        setComprobante(respuesta.data)
      } else {
        setCriterio(respuesta.data.criterio)
        setComprobante(respuesta.data.comprobante || null)
        setCompras(respuesta.data.compras || [])
      }
    } catch (err) {
      if (actual !== version.current) return
      setError(err.status === 404 ? MENSAJE_NO_ENCONTRADO : err.message || 'No se pudo consultar el comprobante.')
    } finally {
      if (actual === version.current) setCargando(false)
    }
  }, [])

  function buscar(event) {
    event?.preventDefault()
    const valor = consulta.trim()
    if (!valor) {
      setError('Escriba el N° de factura, el NIT/CI o escanee el código de barras.')
      return
    }
    ejecutar('buscar', valor)
  }

  function limpiarConsulta(valor) {
    ++version.current
    setConsulta(valor)
    setError('')
    setComprobante(null)
    setCompras([])
    setCriterio(null)
    setUltimaAccion(null)
    setCargando(false)
  }

  return {
    consulta, setConsulta: limpiarConsulta, comprobante, compras, criterio,
    cargando, error, buscar, elegirCompra: (numero) => ejecutar('detalle', numero),
    reintentar: () => ultimaAccion && ejecutar(ultimaAccion.accion, ultimaAccion.valor),
  }
}
