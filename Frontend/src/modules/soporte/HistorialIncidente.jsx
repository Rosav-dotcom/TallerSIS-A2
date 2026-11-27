import { EstadoCargando, EstadoError, LineaTiempo, Tarjeta } from '../../components/ui'
import { mensajeDeError } from './consultas.js'
import { fecha } from './formato.js'

const enOrden = (a, b) => new Date(a.cambiado_en) - new Date(b.cambiado_en)

// TDSI-709: línea de tiempo con los cambios de estado, quién los hizo y cuándo.
function HistorialIncidente({ historial }) {
  const { datos, cargando, error, recargar } = historial
  return (
    <Tarjeta titulo="Historial">
      {cargando && !datos && <EstadoCargando texto="Cargando historial…" />}
      {error && (
        <EstadoError titulo="No pudimos cargar el historial" texto={mensajeDeError(error)} onReintentar={recargar} />
      )}
      {!error && datos?.length === 0 && <p className="sop-nota">Todavía no hay cambios de estado.</p>}
      {!error && datos?.length > 0 && (
        <LineaTiempo
          eventos={[...datos].sort(enOrden).map((h, i) => ({
            id: h.id ?? i,
            titulo: `${fecha(h.cambiado_en)} · ${h.estado_nuevo}`,
            // TDSI-1092: el escalamiento guarda su motivo junto a quién lo hizo.
            detalle: h.motivo ? `${h.usuario} · Motivo: ${h.motivo}` : h.usuario,
            hecho: true,
          }))}
        />
      )}
    </Tarjeta>
  )
}

export default HistorialIncidente
