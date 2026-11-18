import { Check, Info, TriangleAlert, X } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

const ICONO = { exito: Check, advertencia: TriangleAlert, error: TriangleAlert, info: Info }

// Alerta en línea dentro de la pantalla. tono: exito | advertencia | error | info.
export function Alerta({ tono = 'info', titulo, children }) {
  return (
    <div className={`ui-alerta ui-alerta--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <span className="ui-alerta-icono">
        <Icono icono={ICONO[tono]} />
      </span>
      <div>
        {titulo && <strong className="ui-alerta-titulo">{titulo}</strong>}
        {children && <span className="ui-alerta-texto">{children}</span>}
      </div>
    </div>
  )
}

// Notificación (aviso flotante o fijo) con botón de cerrar. tono: exito | error | info.
export function Aviso({ tono = 'info', titulo, children, onCerrar }) {
  return (
    <div className={`ui-aviso ui-aviso--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      <span className="ui-alerta-icono">
        <Icono icono={ICONO[tono]} />
      </span>
      <div className="ui-aviso-contenido">
        <strong className="ui-alerta-titulo">{titulo}</strong>
        {children && <span className="ui-alerta-texto">{children}</span>}
      </div>
      {onCerrar && (
        <button type="button" className="ui-control-boton" onClick={onCerrar} aria-label="Cerrar aviso">
          <Icono icono={X} />
        </button>
      )}
    </div>
  )
}
