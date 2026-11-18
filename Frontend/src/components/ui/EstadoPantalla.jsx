import { Inbox, TriangleAlert } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'
import { Boton } from './Boton.jsx'

// Pantalla o bloque sin datos, con una acción opcional.
export function EstadoVacio({ titulo, texto, accion }) {
  return (
    <div className="ui-estado">
      <span className="ui-estado-icono">
        <Icono icono={Inbox} tamano={40} />
      </span>
      <h3 className="ui-estado-titulo">{titulo}</h3>
      {texto && <p className="ui-estado-texto">{texto}</p>}
      {accion}
    </div>
  )
}

// Bloque cargando: líneas grises fijas (sin animación de adorno).
export function EstadoCargando({ lineas = 3, texto = 'Cargando…' }) {
  return (
    <div className="ui-esqueleto" aria-busy="true" role="status">
      <span className="ui-oculto">{texto}</span>
      {Array.from({ length: lineas }, (_, i) => (
        <span key={i} className="ui-esqueleto-linea" aria-hidden="true" />
      ))}
    </div>
  )
}

// Error al cargar, con botón "Reintentar".
export function EstadoError({ titulo = 'No pudimos cargar los datos', texto, onReintentar }) {
  return (
    <div className="ui-estado" role="alert">
      <span className="ui-estado-icono">
        <Icono icono={TriangleAlert} tamano={40} />
      </span>
      <h3 className="ui-estado-titulo">{titulo}</h3>
      {texto && <p className="ui-estado-texto">{texto}</p>}
      {onReintentar && (
        <Boton variante="contorno" onClick={onReintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  )
}
