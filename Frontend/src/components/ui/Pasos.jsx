import { Check } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Progreso por pasos. pasos: ['Documento', 'Método de pago', ...]; actual: índice desde 0.
function Pasos({ pasos, actual = 0 }) {
  return (
    <ol className="ui-pasos" aria-label="Progreso">
      {pasos.map((texto, i) => {
        const estado = i < actual ? 'hecho' : i === actual ? 'actual' : 'pendiente'
        return (
          <li
            key={texto}
            className={`ui-paso ui-paso--${estado}`}
            aria-current={estado === 'actual' ? 'step' : undefined}
          >
            <span className="ui-paso-numero">{estado === 'hecho' ? <Icono icono={Check} tamano={16} /> : i + 1}</span>
            {texto}
          </li>
        )
      })}
    </ol>
  )
}

export default Pasos
