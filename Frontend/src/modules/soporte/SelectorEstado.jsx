import { Selector } from '../../components/ui'
import { ESTADOS } from './catalogos.js'

// TDSI-709: estado del ticket. Las reglas de transición las aplica el backend (TDSI-693).
// Sin solución no se puede elegir Resuelto: se llega desde "Marcar como resuelto".
function SelectorEstado({ value, tieneSolucion, onCambiar, disabled }) {
  // Un estado que no se elige a mano (Escalado) se muestra, pero no se puede volver a elegir.
  const fueraDeLista = !ESTADOS.includes(value)
  return (
    <Selector
      etiqueta="Estado"
      ayuda={tieneSolucion ? undefined : 'Para marcarlo como Resuelto, registra la solución aplicada.'}
      value={value}
      disabled={disabled}
      onChange={(e) => onCambiar(e.target.value)}
    >
      {fueraDeLista && (
        <option value={value} disabled>
          {value}
        </option>
      )}
      {ESTADOS.map((estado) => (
        <option key={estado} value={estado} disabled={estado === 'Resuelto' && !tieneSolucion}>
          {estado}
        </option>
      ))}
    </Selector>
  )
}

export default SelectorEstado
