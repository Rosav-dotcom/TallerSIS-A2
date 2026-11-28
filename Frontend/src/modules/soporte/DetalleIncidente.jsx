import { useCallback, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Alerta, Boton, Chip, EstadoCargando, EstadoError, EstadoVacio, Tarjeta } from '../../components/ui'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { useRolActual } from '../../hooks/useRolActual.js'
import ComentariosIncidente from './ComentariosIncidente.jsx'
import AvisoEscalado from './AvisoEscalado.jsx'
import DatosOperacion from './DatosOperacion.jsx'
import EscalarIncidenteModal from './EscalarIncidenteModal.jsx'
import HistorialIncidente from './HistorialIncidente.jsx'
import SelectorEstado from './SelectorEstado.jsx'
import SelectorPrioridad from './SelectorPrioridad.jsx'
import SelectorTipo from './SelectorTipo.jsx'
import SolucionIncidente from './SolucionIncidente.jsx'
import { ESCALABLES, TONO_ESTADO } from './catalogos.js'
import { mensajeDeError } from './consultas.js'
import { fecha, texto } from './formato.js'
import { useIncidente } from './useIncidente.js'
import './soporte.css'

// TDSI-64: detalle de un incidente (tipo, prioridad, estado, solución, comentarios e historial).
function DetalleIncidente({ numero }) {
  const { administrador } = useAdminAuth()
  const token = administrador?.access_token
  const i = useIncidente(numero, token)
  const { datos: ticket, error, recargar } = i.ticket
  // TDSI-208: escala el Usuario de Soporte; el Administrador es quien lo recibe.
  const puedeEscalar = useRolActual() === 'USUARIO_SOPORTE'
  const [escalando, setEscalando] = useState(false)
  const [escalado, setEscalado] = useState(false)
  const cerrarAviso = useCallback(() => setEscalado(false), [])

  if (error?.status === 404) {
    return <EstadoVacio titulo="Incidente no encontrado" texto={`No hay ningún incidente con el número ${numero}.`} />
  }
  if (error) return <EstadoError texto={mensajeDeError(error)} onReintentar={recargar} />
  if (!ticket) return <EstadoCargando lineas={6} texto="Cargando incidente…" />

  return (
    <section className="sop-pagina">
      <header className="sop-cabecera">
        <div className="sop-cabecera-titulo">
          <h1>{ticket.numero}</h1>
          <Chip tono={TONO_ESTADO[ticket.estado]}>{ticket.estado}</Chip>
        </div>
        <div className="sop-cabecera-acciones">
          <SelectorEstado
            value={ticket.estado}
            tieneSolucion={Boolean(ticket.solucion)}
            disabled={i.guardando}
            onCambiar={i.cambiarEstado}
          />
          {puedeEscalar && ESCALABLES.includes(ticket.estado) && (
            <Boton variante="contorno" icono={ArrowUpRight} disabled={i.guardando} onClick={() => setEscalando(true)}>
              Escalar a administrador
            </Boton>
          )}
        </div>
      </header>

      {i.errorCambio && <Alerta tono="error" titulo={`No se pudo guardar el cambio: ${i.errorCambio}`} />}

      <div className="sop-detalle">
        <div className="sop-pagina">
          <Tarjeta titulo="Incidente">
            <div className="sop-vista">
              <p className="sop-texto">{ticket.descripcion}</p>
              <DatosOperacion
                datos={[
                  { etiqueta: 'Referencia', valor: texto(ticket.referencia) },
                  { etiqueta: 'Usuario afectado', valor: texto(ticket.usuario_afectado) },
                  { etiqueta: 'Registrado por', valor: texto(ticket.registrado_por) },
                  { etiqueta: 'Fecha', valor: fecha(ticket.creado_en) },
                ]}
              />
              <SelectorTipo value={ticket.tipo} disabled={i.guardando} onCambiar={i.cambiarTipo} />
              <SelectorPrioridad value={ticket.prioridad} disabled={i.guardando} onCambiar={i.cambiarPrioridad} />
            </div>
          </Tarjeta>
          <SolucionIncidente ticket={ticket} guardando={i.guardando} onResolver={i.resolver} />
          <ComentariosIncidente numero={numero} token={token} />
        </div>
        <HistorialIncidente historial={i.historial} />
      </div>

      {escalando && (
        <EscalarIncidenteModal
          numero={ticket.numero}
          onCerrar={() => setEscalando(false)}
          onEscalar={async (motivo) => {
            await i.escalar(motivo)
            setEscalando(false)
            setEscalado(true)
          }}
        />
      )}

      {escalado && <AvisoEscalado numero={ticket.numero} onCerrar={cerrarAviso} />}
    </section>
  )
}

export default DetalleIncidente
