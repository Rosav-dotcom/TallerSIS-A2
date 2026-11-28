import { useCallback, useState } from 'react'
import { obtenerReporteIncidentes } from './api.js'
import { useCarga } from './useCarga.js'

const ZONA = 'America/La_Paz' // los días se cuentan en hora de Bolivia, igual que el backend
const DIA_MS = 24 * 60 * 60 * 1000
export const DIAS_POR_DEFECTO = 30
export const DIAS_MAXIMOS = 366

const hoyEnBolivia = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA })
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA_MS).toISOString().slice(0, 10)
const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS) + 1

function errorDelRango({ desde, hasta }) {
  if (!desde || !hasta) return 'Elige las dos fechas del rango.'
  if (desde > hasta) return 'La fecha final no puede ser anterior a la inicial.'
  if (diasEntre(desde, hasta) > DIAS_MAXIMOS) return `El rango puede tener hasta ${DIAS_MAXIMOS} días.`
  return null
}

// TDSI-212: lógica de "Reportes de incidencias". Empieza con los últimos 30 días y vuelve a
// pedir el reporte cada vez que cambia una fecha (PA TDSI-990). Los cálculos los hace el backend.
export function useReporteIncidentes(token) {
  const [rango, setRango] = useState(() => {
    const hoy = hoyEnBolivia()
    return { desde: sumarDias(hoy, -(DIAS_POR_DEFECTO - 1)), hasta: hoy }
  })
  const errorRango = errorDelRango(rango)
  const { desde, hasta } = rango

  const cargar = useCallback(
    () => (errorRango ? Promise.resolve({ data: null }) : obtenerReporteIncidentes({ desde, hasta }, token)),
    [desde, hasta, token, errorRango],
  )
  const reporte = useCarga(cargar)

  return {
    rango,
    errorRango,
    cambiarFecha: (campo, valor) => setRango((r) => ({ ...r, [campo]: valor })),
    reporte,
  }
}
