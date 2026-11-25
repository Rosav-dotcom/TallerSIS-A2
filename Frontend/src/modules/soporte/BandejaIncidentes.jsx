import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Boton, EstadoCargando, EstadoError, EstadoVacio, Icono } from '../../components/ui'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import TablaIncidentes from './TablaIncidentes.jsx'
import { mensajeDeError } from './consultas.js'
import { useBandejaIncidentes } from './useBandejaIncidentes.js'
import './soporte.css'
import './incidentes.css'

// "Mostrando 21–40 de 57"
function rango({ pagina, limite, total }) {
  const desde = (pagina - 1) * limite + 1
  const hasta = Math.min(pagina * limite, total)
  return `Mostrando ${desde}–${hasta} de ${total}`
}

// TDSI-672: bandeja "Incidentes" (/soporte/incidentes). Lista los tickets de todos los usuarios,
// ordenados por prioridad (Crítica primero) y, dentro de cada una, del más nuevo al más antiguo.
function BandejaIncidentes() {
  const { administrador } = useAdminAuth()
  const b = useBandejaIncidentes(administrador?.access_token)
  const { tickets, paginacion } = b
  const primeraCarga = b.cargando && !paginacion

  return (
    <section className="sop-pagina">
      <header className="sop-bandeja-encabezado">
        <div className="sop-encabezado">
          <h1>Incidentes</h1>
          <p>Tickets de facturación y pagos de todos los usuarios, ordenados por prioridad.</p>
        </div>
      </header>

      {primeraCarga && <EstadoCargando lineas={6} texto="Cargando tickets…" />}

      {!b.cargando && b.error && <EstadoError texto={mensajeDeError(b.error)} onReintentar={b.recargar} />}

      {!b.cargando && !b.error && paginacion && tickets.length === 0 && (
        <EstadoVacio titulo="Todavía no hay tickets" texto="Los tickets registrados aparecerán aquí." />
      )}

      {!b.error && tickets.length > 0 && (
        <div className="sop-bandeja" aria-busy={b.cargando}>
          <TablaIncidentes tickets={tickets} />
          <footer className="sop-paginacion">
            <span>{rango(paginacion)}</span>
            <div className="sop-paginacion-botones">
              <Boton
                variante="contorno"
                icono={ChevronLeft}
                onClick={b.anterior}
                disabled={!b.hayAnterior || b.cargando}
              >
                Anterior
              </Boton>
              <span>
                Página {paginacion.pagina} de {paginacion.paginas}
              </span>
              <Boton variante="contorno" onClick={b.siguiente} disabled={!b.haySiguiente || b.cargando}>
                Siguiente
                <Icono icono={ChevronRight} />
              </Boton>
            </div>
          </footer>
        </div>
      )}
    </section>
  )
}

export default BandejaIncidentes
