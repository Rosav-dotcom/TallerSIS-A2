import { EFECTIVO_USD } from './constantes.js'

const METODOS_PAGO = [
  {
    id: 'Efectivo',
    etiqueta: 'Efectivo',
    icono: (
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="30" height="18" rx="2" />
        <circle cx="16" cy="10" r="4" />
        <circle cx="5" cy="10" r="1" fill="currentColor" stroke="none" />
        <circle cx="27" cy="10" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: EFECTIVO_USD,
    etiqueta: 'Efectivo en dólares',
    icono: (
      <svg width="32" height="20" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="30" height="18" rx="2" />
        <text x="16" y="15" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor" stroke="none">
          $
        </text>
      </svg>
    ),
  },
  {
    id: 'Tarjeta',
    etiqueta: 'Tarjeta',
    icono: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="30" height="20" rx="3" />
        <rect x="1" y="6" width="30" height="4" fill="currentColor" stroke="none" />
        <line x1="5" y1="16" x2="13" y2="16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'QR',
    etiqueta: 'QR',
    icono: (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="1" width="8" height="8" />
        <rect x="17" y="1" width="8" height="8" />
        <rect x="1" y="17" width="8" height="8" />
        <rect x="3.5" y="3.5" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="19.5" y="3.5" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="3.5" y="19.5" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="14" y="14" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="20" y="14" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="14" y="20" width="3" height="3" fill="currentColor" stroke="none" />
        <rect x="20" y="20" width="3" height="3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

// Botones de método de pago (hasta 2 para un pago mixto).
function SeccionMetodoPago({ metodos, esMixto, onToggleMetodo }) {
  return (
    <fieldset className="metodo-opciones" style={{ border: 'none', padding: 0 }}>
      <legend>Método de pago (puede elegir hasta 2 para un pago mixto)</legend>
      <div className="metodo-pago-opciones">
        {METODOS_PAGO.map((metodo) => (
          <button
            key={metodo.id}
            type="button"
            className={`metodo-pago-opcion${metodos.includes(metodo.id) ? ' activa' : ''}`}
            onClick={() => onToggleMetodo(metodo.id)}
          >
            {metodo.icono}
            {metodo.etiqueta}
          </button>
        ))}
      </div>
      {esMixto && <p className="ayuda-mixto">Pago mixto: complete los montos en el panel de la derecha.</p>}
    </fieldset>
  )
}

export default SeccionMetodoPago
