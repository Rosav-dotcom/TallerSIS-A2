import { useEffect, useState } from 'react'
import { obtenerHorasPico } from '../api/tablero.js'
import { listarCajas } from '../api/caja.js'
import GraficoBarras from '../components/GraficoBarras.jsx'
import { COLOR } from '../styles/colores.js'
import { Alerta, CampoTexto, EstadoVacio, Selector, Tarjeta } from '../components/ui'
import './turno.css'
import './admin.css'

const HORA_INICIO = 7
const HORA_FIN = 23
const COLOR_NORMAL = COLOR.navy
const COLOR_PICO = COLOR.gold

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

function etiquetaHora(h) {
  return `${String(h).padStart(2, '0')}:00`
}

// TDSI-192/764-767: pantalla "Horas pico" del Administrador -- ventas por hora del
// dia (07:00 a 23:00) en un rango de fechas, con filtro opcional por caja, y las 3
// horas con mas ventas resaltadas.
function HorasPico() {
  const [cajas, setCajas] = useState([])
  const [desde, setDesde] = useState(hoyLocal)
  const [hasta, setHasta] = useState(hoyLocal)
  const [caja, setCaja] = useState('')

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    listarCajas()
      .then((r) => setCajas(r.data))
      .catch(() => setCajas([]))
  }, [])

  useEffect(() => {
    if (!desde || !hasta) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerHorasPico(desde, hasta, caja)
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [desde, hasta, caja])

  const horasConVentas = new Map((datos?.horas ?? []).map((h) => [h.hora, h]))
  const horasPico = new Set((datos?.top3 ?? []).map((h) => h.hora))

  const items = []
  for (let h = HORA_INICIO; h <= HORA_FIN; h += 1) {
    const dato = horasConVentas.get(h)
    const esPico = horasPico.has(h)
    items.push({
      etiqueta: `${etiquetaHora(h)}${esPico ? ' · Hora pico' : ''}`,
      valor: dato?.cantidad ?? 0,
      color: esPico ? COLOR_PICO : COLOR_NORMAL,
    })
  }

  const hayVentas = (datos?.horas ?? []).length > 0

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Horas pico</h1>
        <p>Cantidad de ventas por hora del día (07:00 a 23:00), con las 3 horas de mayor venta resaltadas.</p>
      </div>

      <div className="adm-filtros">
        <CampoTexto
          etiqueta="Desde"
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => setDesde(e.target.value)}
        />
        <CampoTexto
          etiqueta="Hasta"
          type="date"
          value={hasta}
          min={desde || undefined}
          max={hoyLocal()}
          onChange={(e) => setHasta(e.target.value)}
        />
        <Selector etiqueta="Caja" value={caja} onChange={(e) => setCaja(e.target.value)}>
          <option value="">Todas</option>
          {cajas.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nombre ? `${c.codigo} · ${c.nombre}` : c.codigo}
            </option>
          ))}
        </Selector>
      </div>

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && !hayVentas && <EstadoVacio titulo="Sin ventas en este rango." />}

      {!cargando && !error && hayVentas && (
        <Tarjeta titulo="Ventas por hora">
          <GraficoBarras items={items} formatoValor={(v) => `${v} ${v === 1 ? 'venta' : 'ventas'}`} />
        </Tarjeta>
      )}
    </section>
  )
}

export default HorasPico
