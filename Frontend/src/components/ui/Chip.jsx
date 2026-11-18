import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Tono de cada estado del negocio. El texto siempre identifica el estado; el color lo refuerza.
const TONO_ESTADO = {
  pendiente: 'advertencia',
  enviado: 'info',
  confirmado: 'exito',
  rechazado: 'error',
  error: 'error',
  anulado: 'neutro',
  revertido: 'info',
  pagado: 'exito',
  expirado: 'neutro',
  cuadra: 'exito',
  faltante: 'advertencia',
  sobrante: 'advertencia',
  resuelto: 'exito',
  escalado: 'advertencia',
  total: 'info',
  parcial: 'neutro',
}

// Chip de estado. tono opcional para estados que no están en la lista: exito | advertencia | error | info | neutro.
export function Chip({ children, tono }) {
  const clave = String(children).trim().toLowerCase()
  const t = tono || TONO_ESTADO[clave] || 'neutro'
  return (
    <span className={`ui-chip ui-chip--${t}`}>
      <span className="ui-chip-punto" aria-hidden="true" />
      {children}
    </span>
  )
}

const PRIORIDAD = {
  baja: { tono: 'neutro', icono: ArrowDown },
  media: { tono: 'info', icono: Minus },
  alta: { tono: 'advertencia', icono: ArrowUp },
  critica: { tono: 'critica', icono: null },
}

// Chip de prioridad: Baja, Media, Alta o Crítica.
export function ChipPrioridad({ children }) {
  const clave = String(children).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const p = PRIORIDAD[clave] || PRIORIDAD.media
  return (
    <span className={`ui-chip ui-chip--${p.tono}`}>
      {p.icono ? <Icono icono={p.icono} tamano={14} /> : <span aria-hidden="true">!</span>}
      {children}
    </span>
  )
}
