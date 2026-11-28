import { Link } from 'react-router-dom'
import { Chip, ChipPrioridad, Tabla } from '../../components/ui'
import { FEATURES } from '../../config/features.js'
import { PRIORIDADES, TIPOS, TONO_ESTADO } from './catalogos.js'
import { fecha, texto } from './formato.js'

const TEXTO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto]))
const TEXTO_PRIORIDAD = Object.fromEntries(PRIORIDADES.map((p) => [p.valor, p.texto]))

// TDSI-672: tabla de la bandeja (Figma p.3). El usuario lleva a su historial (TDSI-210). "Ver detalle" abre el detalle del incidente (TDSI-64),
// que se muestra cuando su interruptor (FEATURES.soporteDetalle) está encendido.
// resaltado: número del ticket recién registrado (TDSI-669).
function TablaIncidentes({ tickets, resaltado }) {
  const conDetalle = Boolean(FEATURES.soporteDetalle)
  return (
    <Tabla etiqueta="Tickets de soporte">
      <thead>
        <tr>
          <th>Número</th>
          <th>Tipo</th>
          <th>Usuario</th>
          <th>Fecha</th>
          <th>Prioridad</th>
          <th>Estado</th>
          {conDetalle && <th>Acciones</th>}
        </tr>
      </thead>
      <tbody>
        {tickets.map((t) => (
          <tr key={t.id ?? t.numero} className={t.numero === resaltado ? 'sop-fila--nueva' : undefined}>
            <td className="sop-numero">{t.numero}</td>
            <td>{TEXTO_TIPO[t.tipo] ?? texto(t.tipo)}</td>
            <td className="sop-usuario">
              {t.usuario_afectado ? (
                <Link
                  className="sop-enlace"
                  to={`/soporte/historial?usuario=${encodeURIComponent(t.usuario_afectado)}`}
                  title={`Ver el historial de ${t.usuario_afectado}`}
                >
                  {t.usuario_afectado}
                </Link>
              ) : (
                texto(t.usuario_afectado)
              )}
            </td>
            <td>{fecha(t.creado_en)}</td>
            <td>
              <ChipPrioridad>{TEXTO_PRIORIDAD[t.prioridad] ?? t.prioridad}</ChipPrioridad>
            </td>
            <td>
              <Chip tono={TONO_ESTADO[t.estado]}>{t.estado}</Chip>
            </td>
            {conDetalle && (
              <td>
                <Link className="sop-enlace" to={`/soporte/incidentes/${encodeURIComponent(t.numero)}`}>
                  Ver detalle
                </Link>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}

export default TablaIncidentes
