import GraficoArea from '../../components/GraficoArea.jsx'
import GraficoBarras from '../../components/GraficoBarras.jsx'
import GraficoPastel from '../../components/GraficoPastel.jsx'
import { Chip, Tarjeta } from '../../components/ui'
import { COLOR, SERIE_GRAFICO } from '../../styles/colores.js'
import { tonoSemaforo, valorKpi } from './semaforo.js'

const DIA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dia = (aaaammdd) => DIA.format(new Date(`${aaaammdd}T00:00:00Z`))
const bs = (v) => valorKpi(v, 'Bs')
const pct = (v) => valorKpi(v, '%')

// KPI-1 Ticket promedio por día (línea, Bs).
function GraficoTicketPorDia({ kpi }) {
  const dias = kpi.por_dia.filter((d) => d.ticket_promedio !== null)
  // Con muchos días solo se rotulan ~6 fechas, para que el eje no se salga de la tarjeta
  const cada = Math.max(1, Math.ceil(dias.length / 6))
  const items = dias.map((d, i) => ({
    etiqueta: i % cada === 0 || i === dias.length - 1 ? dia(d.fecha) : '',
    valor: d.ticket_promedio,
  }))
  return (
    <Tarjeta titulo="KPI-1 · Ticket promedio por día">
      {items.length === 0 ? (
        <p className="kpi-sin-datos">Sin ventas cobradas en el periodo.</p>
      ) : (
        <GraficoArea items={items} color={COLOR.navy} formatoValor={bs} />
      )}
    </Tarjeta>
  )
}

// KPI-2 Anulación por cajero (barras horizontales, %), con la cantidad y los Bs anulados.
function GraficoAnulacionPorCajero({ kpi }) {
  const cajeros = kpi.por_cajero.filter((c) => c.porcentaje !== null)
  const color = { exito: COLOR.olive, advertencia: COLOR.gold, error: COLOR.error, neutro: COLOR.muted }
  return (
    <Tarjeta titulo="KPI-2 · Anulación por cajero">
      {cajeros.length === 0 ? (
        <p className="kpi-sin-datos">Sin facturas emitidas en el periodo.</p>
      ) : (
        <>
          <GraficoBarras
            items={cajeros.map((c) => ({
              etiqueta: c.cajero,
              valor: c.porcentaje,
              color: color[tonoSemaforo(c.semaforo?.texto)],
            }))}
            formatoValor={pct}
          />
          <ul className="kpi-lista" aria-label="Facturas anuladas por cajero">
            {cajeros.map((c) => (
              <li key={c.cajero_id}>
                <span>{c.cajero}</span>
                <span>
                  {c.anuladas} de {c.emitidas} · {bs(c.monto_anulado)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  )
}

// KPI-5 Métodos de pago (dona, % del monto). Los % llegan del backend sumando 100,0 exacto.
function GraficoMetodos({ kpi }) {
  const metodos = kpi.metodos.filter((m) => m.porcentaje !== null)
  return (
    <Tarjeta titulo="KPI-5 · Métodos de pago">
      {metodos.length === 0 ? (
        <p className="kpi-sin-datos">Sin ventas cobradas en el periodo.</p>
      ) : (
        <div className="kpi-dona">
          <GraficoPastel
            items={metodos.map((m, i) => ({ etiqueta: m.metodo, valor: m.porcentaje, color: SERIE_GRAFICO[i] }))}
          />
          <ul className="kpi-lista">
            {metodos.map((m, i) => (
              <li key={m.metodo}>
                <span>
                  <span className="grafico-barra-dot" style={{ backgroundColor: SERIE_GRAFICO[i] }} />
                  {m.metodo}
                </span>
                <span>
                  {pct(m.porcentaje)} · {bs(m.monto)}
                </span>
              </li>
            ))}
          </ul>
          {kpi.semaforo?.texto === 'Atención' && (
            <Chip tono="advertencia">Un método cambió más de 10 puntos vs. el mes anterior</Chip>
          )}
        </div>
      )}
    </Tarjeta>
  )
}

// Los 3 gráficos de la pestaña Ventas (tablero-kpis.md).
function GraficosVentas({ kpis }) {
  return (
    <div className="kpi-graficos">
      <GraficoTicketPorDia kpi={kpis.ticket_promedio} />
      <GraficoAnulacionPorCajero kpi={kpis.tasa_anulacion} />
      <GraficoMetodos kpi={kpis.mix_metodos} />
    </div>
  )
}

export default GraficosVentas
