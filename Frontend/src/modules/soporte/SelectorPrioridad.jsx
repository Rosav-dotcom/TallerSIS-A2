import { useId } from 'react'
import { ChipPrioridad } from '../../components/ui'
import { PRIORIDADES } from './catalogos.js'

// TDSI-681: prioridad del ticket con los chips Baja, Media, Alta y Crítica.
function SelectorPrioridad({ value, onCambiar, disabled }) {
  const id = useId()
  return (
    <div className="ui-campo">
      <span id={id} className="ui-campo-etiqueta">
        Prioridad
      </span>
      <div className="sop-prioridades" role="group" aria-labelledby={id}>
        {PRIORIDADES.map((p) => (
          <button
            key={p.valor}
            type="button"
            className="sop-prioridad"
            aria-pressed={p.valor === value}
            disabled={disabled}
            onClick={() => p.valor !== value && onCambiar(p.valor)}
          >
            <ChipPrioridad>{p.texto}</ChipPrioridad>
          </button>
        ))}
      </div>
    </div>
  )
}

export default SelectorPrioridad
