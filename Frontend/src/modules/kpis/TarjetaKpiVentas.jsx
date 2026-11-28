import { Chip, TarjetaKpi } from '../../components/ui'
import { tonoSemaforo, valorKpi } from './semaforo.js'

// Una tarjeta del tablero: valor, semáforo (Chip) y detalle corto. "Fórmula" muestra la fórmula exacta.
function TarjetaKpiVentas({ kpi }) {
  return (
    <TarjetaKpi titulo={kpi.titulo_tarjeta ?? kpi.nombre} valor={valorKpi(kpi.valor, kpi.unidad)} formula={kpi.formula}>
      <div className="kpi-pie">
        <Chip tono={tonoSemaforo(kpi.semaforo?.texto)}>{kpi.semaforo?.texto ?? 'Sin datos'}</Chip>
        <span className="kpi-codigo">{kpi.kpi}</span>
      </div>
      <span className="kpi-detalle">{kpi.detalle}</span>
    </TarjetaKpi>
  )
}

export default TarjetaKpiVentas
