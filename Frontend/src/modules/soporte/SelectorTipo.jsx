import { Selector } from '../../components/ui'
import { TIPOS } from './catalogos.js'

// TDSI-678: tipo del ticket. Lo usan el formulario para registrarlo y su detalle.
function SelectorTipo({ value, onCambiar, disabled }) {
  return (
    <Selector etiqueta="Tipo" value={value} disabled={disabled} onChange={(e) => onCambiar(e.target.value)}>
      {TIPOS.map((t) => (
        <option key={t.valor} value={t.valor}>
          {t.texto}
        </option>
      ))}
    </Selector>
  )
}

export default SelectorTipo
