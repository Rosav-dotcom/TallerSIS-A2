import { useCallback, useEffect, useState } from 'react'
import { listarEnviosComprobante } from './api.js'

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
  return { envio, setEnvio, cargando, error, recargar }
}
