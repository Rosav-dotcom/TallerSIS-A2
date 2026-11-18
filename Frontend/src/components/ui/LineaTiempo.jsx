import { Check, Clock } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Línea de tiempo (trazabilidad). eventos: [{ id, titulo, detalle, hecho }] en orden cronológico.
function LineaTiempo({ eventos }) {
  return (
    <ol className="ui-linea-tiempo">
      {eventos.map((e) => (
        <li key={e.id} className={['ui-evento', e.hecho && 'ui-evento--hecho'].filter(Boolean).join(' ')}>
          <span className="ui-evento-icono">
            <Icono icono={e.hecho ? Check : Clock} tamano={18} />
          </span>
          <div className="ui-evento-texto">
            <span className="ui-evento-titulo">{e.titulo}</span>
            {e.detalle && <span className="ui-evento-detalle">{e.detalle}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export default LineaTiempo
