import { ArrowDown, ArrowUp, Info } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Tarjeta: contenedor de superficie con título y acciones opcionales.
export function Tarjeta({ titulo, acciones, className = '', children }) {
  return (
    <section className={['ui-tarjeta', className].filter(Boolean).join(' ')}>
      {(titulo || acciones) && (
        <header className="ui-tarjeta-cabecera">
          {titulo && <h2 className="ui-tarjeta-titulo">{titulo}</h2>}
          {acciones}
        </header>
      )}
      <div className="ui-tarjeta-cuerpo">{children}</div>
    </section>
  )
}

// Tarjeta de KPI. valor ya formateado ("Bs 1.250,50"). variacion: número en %; formula: texto del tooltip.
export function TarjetaKpi({ titulo, valor, variacion, detalleVariacion = 'vs. ayer', formula, children }) {
  const sube = typeof variacion === 'number' && variacion > 0
  const baja = typeof variacion === 'number' && variacion < 0
  return (
    <section className="ui-tarjeta ui-kpi">
      <div className="ui-kpi-cabecera">
        <span className="ui-kpi-titulo">{titulo}</span>
        {formula && (
          <span className="ui-kpi-formula" title={formula} tabIndex={0}>
            <Icono icono={Info} tamano={14} />
            Fórmula
          </span>
        )}
      </div>
      <span className="ui-kpi-valor">{valor}</span>
      {typeof variacion === 'number' && (
        <span
          className={['ui-kpi-variacion', sube && 'ui-kpi-variacion--sube', baja && 'ui-kpi-variacion--baja']
            .filter(Boolean)
            .join(' ')}
        >
          {sube && <Icono icono={ArrowUp} tamano={14} />}
          {baja && <Icono icono={ArrowDown} tamano={14} />}
          {Math.abs(variacion).toLocaleString('es-BO', { maximumFractionDigits: 1 })} % {detalleVariacion}
        </span>
      )}
      {children}
    </section>
  )
}
