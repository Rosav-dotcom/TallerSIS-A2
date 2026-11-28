import { Search, X } from 'lucide-react'
import { Boton, CampoTexto, Selector } from '../../components/ui'
import { ESTADOS, PRIORIDADES } from './catalogos.js'

// Escalado lo pone el escalamiento (TDSI-65); también se puede filtrar por él.
const ESTADOS_FILTRO = ESTADOS.includes('Escalado') ? ESTADOS : [...ESTADOS, 'Escalado']

// TDSI-675: barra de filtros arriba de la tabla (Figma p.2): número, usuario, rango de fechas,
// estado y prioridad. Solo dibuja; los valores y la búsqueda están en useBandejaIncidentes.
function FiltrosIncidentes({ filtros, onCambiar, onLimpiar, hayFiltros, errorFechas }) {
  const campo = (nombre) => ({ value: filtros[nombre], onChange: (e) => onCambiar(nombre, e.target.value) })
  return (
    <form className="sop-filtros" role="search" aria-label="Filtrar tickets" onSubmit={(e) => e.preventDefault()}>
      <CampoTexto etiqueta="Número" icono={Search} placeholder="INC-000012" autoComplete="off" {...campo('numero')} />
      <CampoTexto etiqueta="Usuario" placeholder="Correo o nombre" autoComplete="off" {...campo('usuario')} />
      <CampoTexto etiqueta="Desde" type="date" max={filtros.hasta || undefined} {...campo('desde')} />
      <CampoTexto
        etiqueta="Hasta"
        type="date"
        min={filtros.desde || undefined}
        error={errorFechas}
        {...campo('hasta')}
      />
      <Selector etiqueta="Estado" {...campo('estado')}>
        <option value="">Todos</option>
        {ESTADOS_FILTRO.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Prioridad" {...campo('prioridad')}>
        <option value="">Todas</option>
        {PRIORIDADES.map((p) => (
          <option key={p.valor} value={p.valor}>
            {p.texto}
          </option>
        ))}
      </Selector>
      {hayFiltros && (
        <div className="sop-filtros-pie">
          <Boton variante="fantasma" icono={X} onClick={onLimpiar}>
            Limpiar filtros
          </Boton>
        </div>
      )}
    </form>
  )
}

export default FiltrosIncidentes
