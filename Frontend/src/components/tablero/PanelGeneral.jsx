import { useEffect, useState } from 'react'
import { obtenerIngresosDia, urlStreamIngresosDia, obtenerRankings, obtenerSerieDiaria } from '../../api/tablero.js'
import { obtenerTotalesGenerales } from '../../api/pagos.js'
import { listarCajas } from '../../api/caja.js'
import GraficoBarras from '../GraficoBarras.jsx'
import GraficoArea from '../GraficoArea.jsx'
import GraficoPastel from '../GraficoPastel.jsx'
import { COLOR } from '../../styles/colores.js'
import { Alerta, CampoTexto, Chip, Tarjeta, TarjetaKpi } from '../ui'

// Colores de marca para gráficos (DESIGN_SYSTEM.md): navy y gold son los de mayor
// contraste entre sí; la identidad nunca depende solo del color (siempre hay etiqueta).
const COLOR_FISICO = COLOR.navy
const COLOR_VIRTUAL = COLOR.gold
const COLOR_CAJA = COLOR.navy
const COLOR_CAJERO = COLOR.gold
const COLOR_EFECTIVO = COLOR.navy
const COLOR_TARJETA = COLOR.olive
const COLOR_QR = COLOR.gold

const formatoBs = (valor) => `Bs. ${valor.toFixed(2)}`

function etiquetaCaja(caja_id) {
  return caja_id === 'SIN_CAJA' ? 'Sin caja asignada' : caja_id
}

// Combina la lista real de cajas activas con los totales que sí tienen ventas,
// para que las cajas sin ventas todavía aparezcan (en 0) en vez de desaparecer.
function mezclarConTodasLasCajas(cajasActivas, totales) {
  const mapa = new Map(totales.map((c) => [c.caja_id, c]))
  return cajasActivas.map((c) => {
    const existente = mapa.get(c.codigo)
    return {
      caja_id: c.codigo,
      total: existente?.total ?? 0,
      cantidadVentas: existente?.cantidadVentas ?? existente?.cantidad ?? 0,
    }
  })
}

// TDSI-379: panel "General" del tablero consolidado de ingresos (dashboard administrador).
function PanelGeneral() {
  const [fecha, setFecha] = useState('') // '' = hoy (se actualiza en vivo)
  const [hoy, setHoy] = useState(null) // fecha de "hoy" segun el backend
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [totalHistorico, setTotalHistorico] = useState(null)
  const [errorHistorico, setErrorHistorico] = useState(null)

  const [rankings, setRankings] = useState(null)
  const [errorRankings, setErrorRankings] = useState(null)

  const [cajasActivas, setCajasActivas] = useState([])

  const [serieDiaria, setSerieDiaria] = useState(null)
  const [errorSerie, setErrorSerie] = useState(null)

  const esHoy = !fecha || fecha === hoy

  // TDSI-328: cuanto ha ganado el negocio en total desde el inicio (todas las cajas).
  useEffect(() => {
    obtenerTotalesGenerales()
      .then((r) => setTotalHistorico(r.data))
      .catch((err) => setErrorHistorico(err.message))
  }, [])

  // TDSI-330: que caja/cajero/cliente generan mas.
  useEffect(() => {
    obtenerRankings()
      .then((r) => setRankings(r.data))
      .catch((err) => setErrorRankings(err.message))
  }, [])

  // TDSI-331: lista real de cajas, para mostrar todas (aunque tengan 0 ventas).
  useEffect(() => {
    listarCajas()
      .then((r) => setCajasActivas(r.data))
      .catch(() => setCajasActivas([]))
  }, [])

  // TDSI-331: ventas de los ultimos 14 dias, para el grafico de montañas.
  useEffect(() => {
    obtenerSerieDiaria(14)
      .then((r) => setSerieDiaria(r.data))
      .catch((err) => setErrorSerie(err.message))
  }, [])

  // TDSI-378: mientras se ve "hoy", el tablero se actualiza solo via Server-Sent Events.
  useEffect(() => {
    if (!esHoy) return

    setCargando(true)
    setError(null)
    const stream = new EventSource(urlStreamIngresosDia())

    stream.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setDatos(data)
      setHoy((prev) => prev ?? data.fecha)
      setCargando(false)
    }
    stream.onerror = () => {
      setError('No se pudo conectar al tablero en tiempo real.')
      setCargando(false)
    }

    return () => stream.close()
  }, [esHoy])

  // TDSI-381: una fecha pasada es una foto fija, no necesita conexion en vivo.
  useEffect(() => {
    if (esHoy) return

    setCargando(true)
    setError(null)
    obtenerIngresosDia(fecha)
      .then((r) => setDatos(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [fecha, esHoy])

  const sinDatos = datos && datos.total_general === 0

  const porCajaCompleto = datos && cajasActivas.length > 0 ? mezclarConTodasLasCajas(cajasActivas, datos.porCaja) : datos?.porCaja ?? []
  const rankingCajasCompleto = rankings && cajasActivas.length > 0 ? mezclarConTodasLasCajas(cajasActivas, rankings.cajas) : rankings?.cajas ?? []

  const serieItems = serieDiaria
    ? serieDiaria.map((d) => ({
        etiqueta: new Date(`${d.fecha}T00:00:00`).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit' }),
        valor: d.total,
      }))
    : []

  return (
    <section className="tab-panel">
      {errorHistorico && <Alerta tono="error" titulo={`Error al cargar el total histórico: ${errorHistorico}`} />}

      {totalHistorico && (
        <div className="tab-kpis">
          <TarjetaKpi titulo="Total histórico ganado" valor={formatoBs(totalHistorico.totalGeneral)} />
          <TarjetaKpi titulo="Efectivo" valor={formatoBs(totalHistorico.totalEfectivo)} />
          <TarjetaKpi titulo="Digital (Tarjeta + QR)" valor={formatoBs(totalHistorico.totalDigital)} />
          <TarjetaKpi titulo="Ventas totales" valor={totalHistorico.cantidadVentas} />
          <div className="tab-kpi--error">
            <TarjetaKpi titulo="Facturas anuladas" valor={totalHistorico.cantidadAnuladas} />
          </div>
        </div>
      )}

      <div className="tab-dos">
        <Tarjeta titulo="Ventas de los últimos 14 días">
          {errorSerie && <Alerta tono="error" titulo={errorSerie} />}
          {serieItems.length > 0 && <GraficoArea items={serieItems} color={COLOR.navy} formatoValor={formatoBs} />}
        </Tarjeta>

        <Tarjeta titulo="Métodos de pago (histórico)">
          {totalHistorico && (
            <GraficoPastel
              items={[
                { etiqueta: 'Efectivo', valor: totalHistorico.totalEfectivo, color: COLOR_EFECTIVO },
                { etiqueta: 'Tarjeta', valor: totalHistorico.totalTarjeta, color: COLOR_TARJETA },
                { etiqueta: 'QR', valor: totalHistorico.totalQR, color: COLOR_QR },
              ]}
              formatoValor={formatoBs}
            />
          )}
        </Tarjeta>
      </div>

      <div className="tab-cabecera">
        <h2>Detalle por día</h2>
      </div>

      <div className="tab-filtros">
        {/* TDSI-381: filtro por fecha */}
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          value={fecha || hoy || ''}
          max={hoy || undefined}
          onChange={(e) => setFecha(e.target.value)}
        />

        {/* Solo existe una sucursal por ahora (ver tableroService.js), asi que se muestra
            como dato informativo en vez de un selector que no tendria nada mas que elegir. */}
        {datos && <span className="tab-dato">Sucursal: {datos.sucursal}</span>}

        {esHoy && !error && (
          <span className="tab-dato">
            <Chip tono="exito">En vivo</Chip>
          </span>
        )}
      </div>

      {cargando && <p className="tab-nota">Cargando...</p>}
      {error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {/* TDSI-382 */}
      {datos && sinDatos && <p className="tab-nota">No hay ingresos registrados para el {datos.fecha}.</p>}

      {datos && !sinDatos && (
        <>
          <div className="tab-kpis">
            <TarjetaKpi titulo="Total del día" valor={formatoBs(datos.total_general)} />
            <TarjetaKpi titulo={`Físico (${datos.fisico.cantidad})`} valor={formatoBs(datos.fisico.total)} />
            <TarjetaKpi titulo={`Virtual (${datos.virtual.cantidad})`} valor={formatoBs(datos.virtual.total)} />
          </div>

          <div className="tab-dos">
            {/* TDSI-380 */}
            <Tarjeta titulo="Ingresos físicos vs virtuales">
              <GraficoBarras
                items={[
                  { etiqueta: 'Físico', valor: datos.fisico.total, color: COLOR_FISICO },
                  { etiqueta: 'Virtual', valor: datos.virtual.total, color: COLOR_VIRTUAL },
                ]}
                formatoValor={formatoBs}
              />
            </Tarjeta>

            {porCajaCompleto.length > 0 && (
              <Tarjeta titulo="Total por caja">
                <GraficoBarras
                  items={porCajaCompleto.map((c) => ({
                    etiqueta: etiquetaCaja(c.caja_id),
                    valor: c.total,
                    color: COLOR_CAJA,
                  }))}
                  formatoValor={formatoBs}
                />
              </Tarjeta>
            )}
          </div>
        </>
      )}

      <div className="tab-cabecera">
        <h2>Rankings</h2>
      </div>
      {errorRankings && <Alerta tono="error" titulo={`Error al cargar los rankings: ${errorRankings}`} />}

      {rankings && (
        <>
          <div className="tab-dos">
            {rankingCajasCompleto.length > 0 && (
              <Tarjeta titulo="Caja que más genera">
                <GraficoBarras
                  items={rankingCajasCompleto.map((c) => ({ etiqueta: c.caja_id, valor: c.total, color: COLOR_CAJA }))}
                  formatoValor={formatoBs}
                />
              </Tarjeta>
            )}

            {rankings.cajeros.length > 0 && (
              <Tarjeta titulo="Cajero que más ha generado">
                <GraficoBarras
                  items={rankings.cajeros.map((c) => ({ etiqueta: c.cajero, valor: c.total, color: COLOR_CAJERO }))}
                  formatoValor={formatoBs}
                />
              </Tarjeta>
            )}
          </div>

          {rankings.clientes.length > 0 && (
            <Tarjeta titulo="Clientes que más han venido">
              <ol className="tab-ranking">
                {rankings.clientes.map((c) => (
                  <li key={`${c.tipo_documento}-${c.numero}`}>
                    <span>{c.razon_social || 'Consumidor final'}</span>
                    <span className="tab-detalle">
                      {c.tipo_documento} {c.numero}
                    </span>
                    <span className="tab-num">{c.cantidadCompras} compras</span>
                    <strong className="tab-num">{formatoBs(c.totalGastado)}</strong>
                  </li>
                ))}
              </ol>
            </Tarjeta>
          )}
        </>
      )}
    </section>
  )
}

export default PanelGeneral
