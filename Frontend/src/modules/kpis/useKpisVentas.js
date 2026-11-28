import { useEffect, useState } from 'react'
import { obtenerKpisVentas } from './api.js'

// TDSI-653: carga la pestaña Ventas y la vuelve a pedir cada vez que cambia un filtro (Periodo,
// Caja o Cajero), así las tarjetas se actualizan (PA de TDSI-640). Mientras llega la nueva
// respuesta, los datos anteriores siguen en pantalla. Solo vale la respuesta del último pedido.
export function useKpisVentas(filtros) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)
  const { desde, hasta, caja_id, cajero_id } = filtros

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerKpisVentas({ desde, hasta, caja_id, cajero_id })
      .then(({ data }) => vigente && setDatos(data))
      .catch((err) => vigente && setError(err))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [desde, hasta, caja_id, cajero_id, intento])

  return { datos, cargando, error, recargar: () => setIntento((n) => n + 1) }
}
