import { Alerta, EstadoCargando, EstadoError } from '../../components/ui'
import GraficosVentas from './GraficosVentas.jsx'
import TarjetaKpiVentas from './TarjetaKpiVentas.jsx'
import { useKpisVentas } from './useKpisVentas.js'

const ORDEN = ['ticket_promedio', 'tasa_anulacion', 'mix_metodos', 'cumplimiento_meta', 'tasa_canceladas']

function mensajeDeError(err) {
  if (err instanceof TypeError) return 'No se pudo conectar con el servicio de Pagos.'
  return err.message
}

// TDSI-653 (TDSI-640): pestaña "Ventas" del Tablero de KPIs. 5 tarjetas (KPI-1, 2, 5, 6 y 8) con su
// fórmula y semáforo, y sus 3 gráficos. Los valores, semáforos y detalles los calcula el backend
// (TDSI-650); la pantalla no recalcula nada. filtros: { desde, hasta, caja_id, cajero_id }.
function SeccionVentas({ filtros }) {
  const { datos, cargando, error, recargar } = useKpisVentas(filtros)

  if (cargando && !datos) return <EstadoCargando lineas={6} texto="Calculando los KPIs de ventas…" />
  if (error && !datos) {
    return (
      <EstadoError
        titulo="No pudimos cargar los KPIs de ventas"
        texto={mensajeDeError(error)}
        onReintentar={recargar}
      />
    )
  }

  return (
    <div className="kpi-seccion" aria-busy={cargando}>
      {error && <Alerta tono="error" titulo={`No se pudieron actualizar los KPIs: ${mensajeDeError(error)}`} />}
      {datos.avisos?.map((aviso) => (
        <Alerta key={aviso} tono="info" titulo={aviso} />
      ))}
      <div className="kpi-tarjetas">
        {ORDEN.map((clave) => (
          <TarjetaKpiVentas key={clave} kpi={datos.kpis[clave]} />
        ))}
      </div>
      <GraficosVentas kpis={datos.kpis} />
    </div>
  )
}

export default SeccionVentas
