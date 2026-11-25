import { useEffect, useState } from 'react'

// Carga datos de la API y los guarda. `cargar` tiene que ser estable (useCallback).
// Al recargar, los datos anteriores siguen en pantalla hasta que llegan los nuevos.
export function useCarga(cargar) {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    cargar()
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [cargar, intento])

  return { datos, setDatos, cargando, error, recargar: () => setIntento((n) => n + 1) }
}
