import { CampoTexto, EstadoCargando, EstadoError, EstadoVacio, TarjetaKpi } from '../../components/ui'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import GraficoPorEstado from './GraficoPorEstado.jsx'
import TablaProblemasFrecuentes from './TablaProblemasFrecuentes.jsx'
import { mensajeDeError } from './consultas.js'
import { useReporteIncidentes } from './useReporteIncidentes.js'
import './soporte.css'
import './incidentes.css'

const ESTADOS_RESUELTOS = ['Resuelto', 'Cerrado']
const NUMERO = new Intl.NumberFormat('es-BO')
const FECHA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dia = (aaaammdd) => FECHA.format(new Date(`${aaaammdd}T00:00:00Z`))

function cantidadEn(lista, estados) {
  return lista.filter((e) => estados.includes(e.estado)).reduce((suma, e) => suma + e.cantidad, 0)
}

// Fila de 4 tarjetas (Figma p.3): los números llegan ya calculados del backend; aquí solo se formatean.
function TotalesReporte({ reporte }) {
  const resueltos = cantidadEn(reporte.por_estado, ESTADOS_RESUELTOS)
  const promedio = reporte.tiempo_promedio_atencion
  return (
    <div className="sop-kpis">
      <TarjetaKpi titulo="Incidentes del rango" valor={NUMERO.format(reporte.total)}>
        <span className="sop-kpi-detalle">
          {reporte.rango.dias} {reporte.rango.dias === 1 ? 'día' : 'días'}
        </span>
      </TarjetaKpi>
      <TarjetaKpi titulo="Sin resolver" valor={NUMERO.format(reporte.total - resueltos)}>
        <span className="sop-kpi-detalle">Abiertos, en proceso, pendientes o escalados</span>
      </TarjetaKpi>
      <TarjetaKpi titulo="Resueltos o cerrados" valor={NUMERO.format(resueltos)} />
      <TarjetaKpi
        titulo="Tiempo promedio de atención"
        valor={promedio.promedio_minutos === null ? '—' : promedio.texto}
        formula="Promedio de (fecha en que se resolvió − fecha de registro), solo con incidentes resueltos o cerrados"
      >
        <span className="sop-kpi-detalle">
          {promedio.incidentes_resueltos === 0
            ? 'Sin incidentes resueltos en el rango'
            : `Con ${NUMERO.format(promedio.incidentes_resueltos)} ${promedio.incidentes_resueltos === 1 ? 'incidente resuelto' : 'incidentes resueltos'}`}
        </span>
      </TarjetaKpi>
    </div>
  )
}

// TDSI-212: "Reportes de incidencias" (/soporte/reportes). Figma p.8 (menú), p.2 (rango de fechas)
// p.3 (tarjetas de indicador) y p.5 (gráfico de barras, TDSI-1075).
function ReportesIncidencias() {
  const { administrador } = useAdminAuth()
  const r = useReporteIncidentes(administrador?.access_token)
  const { datos, cargando, error, recargar } = r.reporte

  return (
    <section className="sop-pagina">
      <header className="sop-bandeja-encabezado">
        <div className="sop-encabezado">
          <h1>Reportes de incidencias</h1>
          <p>
            {datos && !r.errorRango
              ? `Del ${dia(datos.rango.desde)} al ${dia(datos.rango.hasta)}, según la fecha de registro.`
              : 'Totales del rango elegido, según la fecha de registro del incidente.'}
          </p>
        </div>
        <form className="sop-rango" aria-label="Rango del reporte" onSubmit={(e) => e.preventDefault()}>
          <CampoTexto
            etiqueta="Desde"
            type="date"
            max={r.rango.hasta || undefined}
            value={r.rango.desde}
            onChange={(e) => r.cambiarFecha('desde', e.target.value)}
          />
          <CampoTexto
            etiqueta="Hasta"
            type="date"
            min={r.rango.desde || undefined}
            value={r.rango.hasta}
            error={r.errorRango}
            onChange={(e) => r.cambiarFecha('hasta', e.target.value)}
          />
        </form>
      </header>

      {cargando && !datos && <EstadoCargando lineas={4} texto="Calculando el reporte…" />}
      {!cargando && error && <EstadoError texto={mensajeDeError(error)} onReintentar={recargar} />}
      {!error && !r.errorRango && datos && (
        <div className="sop-pagina" aria-busy={cargando}>
          <TotalesReporte reporte={datos} />
          {datos.total > 0 && (
            <div className="sop-reporte-detalle">
              <GraficoPorEstado porEstado={datos.por_estado} total={datos.total} />
              <TablaProblemasFrecuentes problemas={datos.problemas_frecuentes} />
            </div>
          )}
          {datos.total === 0 && (
            <EstadoVacio
              titulo="No hay incidentes en este rango"
              texto="Prueba con otras fechas para ver los totales del reporte."
            />
          )}
        </div>
      )}
    </section>
  )
}

export default ReportesIncidencias
