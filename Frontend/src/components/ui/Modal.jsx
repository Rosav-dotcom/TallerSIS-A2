import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Modal accesible: Escape cierra, el foco entra al abrir y vuelve al cerrar.
// acciones: botones del pie (Cancelar a la izquierda, acción principal a la derecha).
// ancho: para contenido con tablas o resúmenes (hasta 760 px).
function Modal({ abierto, titulo, onCerrar, acciones, cerrarAlClicFuera = false, ancho = false, children }) {
  const idTitulo = useId()
  const ref = useRef(null)
  // onCerrar suele ser una función nueva en cada render: se guarda en una referencia para que
  // el foco se mueva solo al abrir el modal, y no mientras se escribe en sus campos.
  const cerrarRef = useRef(onCerrar)
  cerrarRef.current = onCerrar

  useEffect(() => {
    if (!abierto) return undefined
    // El elemento que tenía el foco antes de abrir; en el primer render todavía está fuera del modal.
    const previo = ref.current?.contains(document.activeElement) ? null : document.activeElement
    // Si un campo del modal ya tomó el foco (autoFocus), se respeta; si no, va al primer control.
    if (!ref.current?.contains(document.activeElement)) {
      const primero = ref.current?.querySelector('input, select, textarea, button:not([data-cerrar])')
      ;(primero || ref.current)?.focus()
    }
    function tecla(e) {
      if (e.key === 'Escape') cerrarRef.current?.()
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
  }, [abierto])

  if (!abierto) return null
  return (
    <div
      className="ui-modal-velo"
      onMouseDown={(e) => cerrarAlClicFuera && e.target === e.currentTarget && onCerrar?.()}
    >
      <div className={`ui-modal${ancho ? ' ui-modal--ancho' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={ref} tabIndex={-1}>
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
