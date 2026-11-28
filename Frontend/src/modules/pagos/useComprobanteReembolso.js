import { useCallback, useEffect, useState } from 'react'
import { listarEnviosComprobante, reenviarComprobante } from './api.js'
import { mensajeDeError } from './formato.js'

// TDSI-236: lógica de la página "Comprobante de reembolso". El comprobante es el que se mandó al
// cliente (lo guarda gestion_pagos con cada envío): se toma el envío más nuevo de la devolución.
export function useComprobanteReembolso(devolucionId) {
  const [envio, setEnvio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarEnviosComprobante(devolucionId)
      .then(({ data }) => vigente && setEnvio(data[0] ?? null))
      .catch((err) => vigente && setError(err))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [devolucionId, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  // TDSI-1084: reenvío. El estado que devuelve el backend (Enviado o Error) reemplaza al anterior.
  const [reenviando, setReenviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errorReenvio, setErrorReenvio] = useState(null)

  async function reenviar(email) {
    setReenviando(true)
    setResultado(null)
    setErrorReenvio(null)
    try {
      const { data, mensaje } = await reenviarComprobante(envio.id, email)
      setEnvio(data)
      if (data.estado === 'Enviado') setResultado(mensaje)
      return data
    } catch (err) {
      setErrorReenvio(mensajeDeError(err))
      throw err
    } finally {
      setReenviando(false)
    }
  }

  return {
    envio,
    cargando,
    error,
    recargar,
    reenviando,
    resultado,
    errorReenvio,
    reenviar,
    cerrarResultado: () => setResultado(null),
  }
}
