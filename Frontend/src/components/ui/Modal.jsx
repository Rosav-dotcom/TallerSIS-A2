import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Modal accesible: Escape cierra, el foco entra al abrir y vuelve al cerrar.
// acciones: botones del pie (Cancelar a la izquierda, acción principal a la derecha).
function Modal({ abierto, titulo, onCerrar, acciones, cerrarAlClicFuera = false, children }) {
  const idTitulo = useId()
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const previo = document.activeElement
    const primero = ref.current?.querySelector('input, select, textarea, button:not([data-cerrar])')
    ;(primero || ref.current)?.focus()
    function tecla(e) {
      if (e.key === 'Escape') onCerrar?.()
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div
      className="ui-modal-velo"
      onMouseDown={(e) => cerrarAlClicFuera && e.target === e.currentTarget && onCerrar?.()}
    >
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={ref} tabIndex={-1}>
        <div className="ui-modal-cabecera">
          <h2 id={idTitulo} className="ui-modal-titulo">
            {titulo}
          </h2>
          {onCerrar && (
            <button type="button" className="ui-control-boton" onClick={onCerrar} aria-label="Cerrar" data-cerrar>
              <Icono icono={X} />
            </button>
          )}
        </div>
        {children}
        {acciones && <div className="ui-modal-acciones">{acciones}</div>}
      </div>
    </div>
  )
}

export default Modal
