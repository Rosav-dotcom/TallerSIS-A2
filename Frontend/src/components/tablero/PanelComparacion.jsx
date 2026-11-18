import { useEffect, useState } from 'react'
import { listarCajas, obtenerComparacionMontos } from '../../api/caja.js'
import { Alerta, Boton, CampoTexto, Chip, Selector, Tabla, TarjetaKpi } from '../ui'

const ETIQUETA_TIPO = {
  CUADRA: 'Cuadra',
  FALTANTE: 'Faltante',
  SOBRANTE: 'Sobrante',
  SIN_ARQUEO: 'Sin arqueo',
}

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// El turno puede no tener arqueo todavia (SIN_ARQUEO): esos valores vienen null.
const bs = (v) => (v == null ? '—' : v.toFixed(2))

function PanelComparacion() {
  const [fecha, setFecha] = useState(hoyLocal)
  const [filtroCaja, setFiltroCaja] = useState('')
  const [filtroCajero, setFiltroCajero] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  const [cajas, setCajas] = useState([])
  const [cajeros, setCajeros] = useState([])
  const [resumen, setResumen] = useState(null)
  const [turnos, setTurnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    listarCajas()
      .then((r) => setCajas(r.data))
      .catch(() => setCajas([]))
  }, [])

  useEffect(() => {
    setCajeros([])
    setFiltroCajero('')
  }, [fecha])

  useEffect(() => {
    if (!fecha) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerComparacionMontos({ fecha, caja_id: filtroCaja, cajero_id: filtroCajero, tipo: filtroTipo })
      .then((r) => {
        if (!vigente) return
        setResumen(r.data.resumen)
        setTurnos(r.data.turnos)
        setCajeros((prev) => {
          const porId = new Map(prev.map((c) => [c.id, c]))
          r.data.turnos.forEach((t) => {
            if (!porId.has(t.cajero_id)) porId.set(t.cajero_id, { id: t.cajero_id, nombre: t.cajero_nombre || t.cajero_id })
          })
          return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
        })
      })
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, filtroCaja, filtroCajero, filtroTipo, recargar])

  const hayFiltros = filtroCaja || filtroCajero || filtroTipo

  function quitarFiltros() {
    setFiltroCaja('')
    setFiltroCajero('')
    setFiltroTipo('')
  }

  return (
    <section className="tab-panel">
      <div className="tab-cabecera">
        <div>
          <h2>Comparación de montos</h2>
          <p>Monto registrado por el sistema contra el efectivo disponible en caja, por turno.</p>
        </div>
      </div>

      <div className="tab-filtros">
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          value={fecha}
          max={hoyLocal()}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Selector etiqueta="Caja" value={filtroCaja} onChange={(e) => setFiltroCaja(e.target.value)}>
          <option value="">Todas</option>
          {cajas.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nombre ? `${c.codigo} · ${c.nombre}` : c.codigo}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Cajero" value={filtroCajero} onChange={(e) => setFiltroCajero(e.target.value)}>
          <option value="">Todos</option>
          {cajeros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Diferencia" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todas</option>
          <option value="CUADRA">Cuadra</option>
          <option value="FALTANTE">Faltante</option>
          <option value="SOBRANTE">Sobrante</option>
        </Selector>
        {hayFiltros && (
          <Boton variante="contorno" onClick={quitarFiltros}>
            Quitar filtros
          </Boton>
        )}
      </div>

      {cargando && <p className="tab-nota">Cargando...</p>}

      {!cargando && error && (
        <div className="tab-filtros">
          <Alerta tono="error" titulo={`No se pudo obtener la comparación: ${error}`} />
          <Boton variante="contorno" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </Boton>
        </div>
      )}

      {!cargando && !error && resumen && (
        <div className="tab-kpis">
          <TarjetaKpi titulo="Turnos" valor={resumen.total} />
          <div className="tab-kpi--exito">
            <TarjetaKpi titulo="Cuadran" valor={resumen.cuadran} />
          </div>
          <div className="tab-kpi--advertencia">
            <TarjetaKpi titulo="Faltantes" valor={resumen.faltantes} />
          </div>
          <div className="tab-kpi--advertencia">
            <TarjetaKpi titulo="Sobrantes" valor={resumen.sobrantes} />
          </div>
        </div>
      )}

      {!cargando && !error && turnos.length === 0 && (
        <Alerta
          tono="info"
          titulo={
            hayFiltros ? 'No hay turnos que coincidan con los filtros en esta fecha.' : 'No hubo turnos en esta fecha.'
          }
        />
      )}

      {!cargando && !error && turnos.length > 0 && (
        <Tabla etiqueta="Comparación por turno">
          <thead>
            <tr>
              <th>Turno</th>
              <th>Caja</th>
              <th>Cajero</th>
              <th className="ui-num">Registrado (Bs.)</th>
              <th className="ui-num">Disponible (Bs.)</th>
              <th className="ui-num">Diferencia (Bs.)</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => {
              const tipoRaw = t.tipo_diferencia || 'CUADRA' // Si viene nulo, asume cuadra
              const tipo = tipoRaw.toLowerCase()
              return (
                <tr key={t.turno_id}>
                  <td>
                    {t.codigo}
                    <span className="tab-detalle">{t.estado === 'ABIERTO' ? 'Abierto' : 'Cerrado'}</span>
                  </td>
                  <td>{t.caja_id}</td>
                  <td>{t.cajero_nombre || t.cajero_id}</td>
                  <td className="ui-num">{bs(t.efectivo_esperado)}</td>
                  <td className="ui-num">{bs(t.efectivo_contado)}</td>
                  <td className={`ui-num tab-diferencia--${tipo}`}>
                    {t.diferencia > 0 ? '+' : ''}
                    {bs(t.diferencia)}
                  </td>
                  <td>
                    <Chip>{ETIQUETA_TIPO[tipoRaw] ?? tipoRaw}</Chip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Tabla>
      )}
    </section>
  )
}

export default PanelComparacion
