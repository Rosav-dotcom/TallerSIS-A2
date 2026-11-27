import {
  Alerta,
  Boton,
  Chip,
  ChipPrioridad,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Tabla,
} from '../../components/ui'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { PRIORIDADES, TONO_ESTADO } from './catalogos.js'
import { mensajeDeError } from './consultas.js'
import { fecha, texto } from './formato.js'
import { useIncidentesEscalados } from './useIncidentesEscalados.js'
import './soporte.css'
import './incidentes.css'

const TEXTO_PRIORIDAD = Object.fromEntries(PRIORIDADES.map((p) => [p.valor, p.texto]))

// TDSI-1073: bandeja "Incidentes escalados" del Administrador (/admin/soporte/escalados).
// Figma p.8 y p.75 (menú) y p.3 (tabla y chip "Escalado").
function IncidentesEscalados() {
  const { administrador } = useAdminAuth()
  const { escalados, tomando, errorTomar, tomar } = useIncidentesEscalados(administrador?.access_token)
  const { datos: tickets, cargando, error, recargar } = escalados

  return (
    <section className="sop-pagina">
      <header className="sop-encabezado">
        <h1>Incidentes escalados</h1>
        <p>Incidentes que Soporte no pudo resolver, ordenados por prioridad y por tiempo de espera.</p>
      </header>

      {errorTomar && <Alerta tono="error" titulo={errorTomar} />}

      {cargando && !tickets && <EstadoCargando lineas={5} texto="Cargando incidentes escalados…" />}
      {!cargando && error && <EstadoError texto={mensajeDeError(error)} onReintentar={recargar} />}
      {!cargando && !error && tickets?.length === 0 && (
        <EstadoVacio
          titulo="No hay incidentes escalados"
          texto="Cuando Soporte escale un incidente, aparecerá aquí para que lo tomes y lo resuelvas."
        />
      )}
      {!error && tickets?.length > 0 && (
        <Tabla etiqueta="Incidentes escalados" aria-busy={cargando}>
          <thead>
            <tr>
              <th>Número</th>
              <th>Prioridad</th>
              <th>Motivo del escalamiento</th>
              <th>Escalado por</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.numero}>
                <td className="sop-numero">{t.numero}</td>
                <td>
                  <ChipPrioridad>{TEXTO_PRIORIDAD[t.prioridad] ?? t.prioridad}</ChipPrioridad>
                </td>
                <td className="sop-motivo">{texto(t.motivo_escalamiento)}</td>
                <td>
                  <span className="sop-quien">{texto(t.escalado_por)}</span>
                  <span className="sop-cuando">{fecha(t.escalado_en)}</span>
                </td>
                <td>
                  <Chip tono={TONO_ESTADO[t.estado]}>{t.estado}</Chip>
                </td>
                <td>
                  <Boton
                    variante="contorno"
                    className="sop-accion"
                    disabled={Boolean(tomando)}
                    onClick={() => tomar(t.numero)}
                  >
                    {tomando === t.numero ? 'Tomando…' : 'Tomar y resolver'}
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </section>
  )
}

export default IncidentesEscalados
