import './ui.css'
import Icono from './Icono.jsx'

// Botón de acción. variante: primario | secundario | contorno | fantasma | peligro.
export function Boton({
  variante = 'primario',
  icono,
  ancho = false,
  type = 'button',
  className = '',
  children,
  ...resto
}) {
  const clases = ['ui-boton', `ui-boton--${variante}`, ancho && 'ui-boton--ancho', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={clases} {...resto}>
      {icono && <Icono icono={icono} />}
      {children}
    </button>
  )
}

// Opción grande seleccionable (métodos de pago, motivos, formas de reembolso). Alto de 72 px.
export function BotonOpcion({ activa = false, icono, className = '', children, ...resto }) {
  const clases = ['ui-opcion', activa && 'ui-opcion--activa', className].filter(Boolean).join(' ')
  return (
    <button type="button" className={clases} aria-pressed={activa} {...resto}>
      {icono && <Icono icono={icono} tamano={24} />}
      <span>{children}</span>
    </button>
  )
}
