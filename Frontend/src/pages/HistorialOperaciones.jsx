import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alerta,
  Boton,
  CampoTexto,
  Chip,
  EstadoCargando,
  EstadoVacio,
  Selector,
  Tabla,
  TarjetaKpi,
} from '../components/ui'
import './turno.css'
import './admin.css'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const CAJA_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4004'
const CAJEROS_URL = `${BASE_URL}/api/pagos/revision/cajeros`
const HISTORIAL_URL = `${BASE_URL}/api/pagos/historial-cajeros`
// TDSI-62/963/964: apertura, cierre y aprobacion de operaciones especiales (gestion_caja),
// para combinar con las ventas/anulaciones de arriba (gestion_pagos) en una sola tabla.
const EVENTOS_URL = `${CAJA_BASE_URL}/api/caja/eventos-autorizacion`
const POR_PAGINA = 10
// Tope de paginas de ventas que se traen para combinar con los eventos de gestion_caja
// (un rango de fechas angosto no debería acercarse a esto; de lo contrario, el filtro
// por cajero o por fechas más corto es la forma de acotar la consulta).
const MAX_PAGINAS_VENTAS = 10

const ETIQUETA_TIPO = {
  APERTURA: 'Apertura',
  CIERRE: 'Cierre',
  OPERACION_ESPECIAL: 'Operación especial',
}
const TIPOS_CON_AUTORIZACION = new Set(['ANULADA', 'APERTURA', 'CIERRE', 'OPERACION_ESPECIAL'])

const aFechaLocal = (fecha) => {
  const offset = fecha.getTimezoneOffset()
  return new Date(fecha.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const fechaHoy = () => aFechaLocal(new Date())

const hace7Dias = () => {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return aFechaLocal(d)
}

const formatearMoneda = (valor) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0)

const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/

const aFecha = (valor) => {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

const formatearDia = (dia) => {
  if (!SOLO_FECHA.test(dia)) return String(dia || '—')
  const [anio, mes, d] = dia.split('-')
  return `${d}/${mes}/${anio}`
}

const formatearFechaHora = (valor) => {
  if (!valor) return '—'
  if (typeof valor === 'string' && SOLO_FECHA.test(valor)) return formatearDia(valor)
  const d = aFecha(valor)
  if (!d) return String(valor)
  return d.toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// TDSI-62/960: etiqueta de color por tipo de operacion autorizada (apertura, cierre,
// anulacion, aprobacion); el resto de los estados de venta sigue como antes.
const tonoEstado = (estado) => {
  const v = String(estado).toUpperCase()
  if (!v) return 'neutro'
  if (v === 'APERTURA') return 'exito'
  if (v === 'CIERRE') return 'neutro'
  if (v === 'OPERACION_ESPECIAL') return 'info'
  if (/ANUL|RECHAZ|ERROR|FALL/.test(v)) return 'error'
  if (/PEND/.test(v)) return 'advertencia'
  return 'exito'
}

const etiquetaEstado = (estado) => ETIQUETA_TIPO[estado] || estado

// TDSI-62/961: solo las operaciones que de verdad necesitaron un supervisor (anulacion,
// apertura, cierre, operacion especial) muestran quien autorizo; el resto muestra "—",
// y las de antes de este cambio (sin el dato guardado) muestran "No registrado".
const autorizadoPorMostrar = (op) => {
  if (!TIPOS_CON_AUTORIZACION.has(op.estado)) return '—'
  return op.autorizado_por || 'No registrado'
}

const obtenerMensajeError = (error) => {
  const status = error?.status
  if (status === 400 || status === 422) return error?.message || 'Los filtros enviados no son válidos.'
  if (status === 502 || status === 503) return 'El servicio no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo obtener el historial.'
  return 'No se pudo conectar con el servidor. Verifique su conexión.'
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {}

  if (!response.ok) {
    const error = new Error(
      data?.mensaje || data?.message || data?.detalle?.mensaje || 'Ocurrió un error al comunicarse con el servidor.'
    )
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export default function HistorialOperaciones() {
  const [cajeros, setCajeros] = useState([])
  const [cargandoCajeros, setCargandoCajeros] = useState(true)
  const [errorCajeros, setErrorCajeros] = useState('')
  const [cajeroId, setCajeroId] = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [desde, setDesde] = useState(hace7Dias)
  const [hasta, setHasta] = useState(fechaHoy)

  // TDSI-62/963/964: lista combinada de ventas/anulaciones (gestion_pagos) + apertura,
  // cierre y operaciones especiales (gestion_caja), ya ordenada por fecha. La paginacion
  // se hace en el navegador sobre esta lista combinada (ver "visibles" mas abajo).
  const [operaciones, setOperaciones] = useState([])
  const [resumen, setResumen] = useState(null)
  const [avisoEventos, setAvisoEventos] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [orden, setOrden] = useState('desc')
  const [pagina, setPagina] = useState(1)

  const peticion = useRef(0)
  const rangoInvalido = Boolean(desde && hasta && desde > hasta)

  useEffect(() => {
    let activo = true
    ;(async () => {
      if (rangoInvalido) return
      setCargandoCajeros(true)
      try {
        const res = await requestJson(`${CAJEROS_URL}?desde=${desde}&hasta=${hasta}`)
        const datos = res?.data ?? res
        if (activo) setCajeros(Array.isArray(datos) ? datos : datos?.cajeros ?? [])
      } catch (err) {
        if (activo) setErrorCajeros(obtenerMensajeError(err))
      } finally {
        if (activo) setCargandoCajeros(false)
      }
    })()
    return () => { activo = false }
  }, [desde, hasta, rangoInvalido])

  // Trae todas las ventas/anulaciones del rango (paginando por dentro, hasta
  // MAX_PAGINAS_VENTAS), ya que la paginacion final es sobre la lista combinada.
  async function obtenerTodasLasVentas(params) {
    const primera = await requestJson(`${HISTORIAL_URL}?${new URLSearchParams({ ...params, pagina: 1, por_pagina: 100 })}`)
    const datos = primera?.data ?? primera
    let operaciones = datos.operaciones ?? []
    const resumen = datos.resumen ?? null
    const totalPaginas = Math.min(datos.paginacion?.total_paginas ?? 1, MAX_PAGINAS_VENTAS)
    for (let p = 2; p <= totalPaginas; p++) {
      const r = await requestJson(`${HISTORIAL_URL}?${new URLSearchParams({ ...params, pagina: p, por_pagina: 100 })}`)
      operaciones = operaciones.concat((r?.data ?? r).operaciones ?? [])
    }
    return { operaciones, resumen }
  }

  const normalizarVenta = (op) => ({
    key: `VTA-${op.id_transaccion}`,
    fecha: op.fecha,
    metodos: op.metodos,
    total: op.total,
    estado: op.estado,
    pedido_por: op.pedido_por,
    autorizado_por: op.autorizado_por,
  })

  const normalizarEvento = (e, i) => ({
    key: `EVT-${e.tipo}-${e.caja_id}-${e.fecha}-${i}`,
    fecha: e.fecha,
    metodos: e.descripcion || etiquetaEstado(e.tipo),
    total: e.monto,
    estado: e.tipo,
    pedido_por: e.pedido_por,
    autorizado_por: e.autorizado_por,
  })

  const cargarHistorial = useCallback(async () => {
    if (!desde || !hasta || rangoInvalido) {
      setOperaciones([])
      setResumen(null)
      setAvisoEventos('')
      setError('')
      return
    }
    const actual = ++peticion.current
    setCargando(true)
    setError('')
    setAvisoEventos('')
    try {
      const paramsVentas = { desde, hasta }
      if (cajeroId) paramsVentas.cajero_id = cajeroId
      // TDSI-62/959: filtrar por el supervisor que autorizo (anulacion, apertura, cierre u operacion especial).
      const supervisor = supervisorId.trim()
      if (supervisor) paramsVentas.supervisor_id = supervisor

      const paramsEventos = new URLSearchParams({ desde, hasta })
      if (supervisor) paramsEventos.append('supervisor_id', supervisor)

      const [ventasResultado, eventosResultado] = await Promise.allSettled([
        obtenerTodasLasVentas(paramsVentas),
        requestJson(`${EVENTOS_URL}?${paramsEventos}`),
      ])
      if (actual !== peticion.current) return

      if (ventasResultado.status === 'rejected') throw ventasResultado.reason

      const ventas = ventasResultado.value.operaciones.map(normalizarVenta)

      let eventos = []
      if (eventosResultado.status === 'fulfilled') {
        const datosEventos = eventosResultado.value?.data ?? eventosResultado.value
        eventos = (datosEventos.eventos ?? [])
          .filter((e) => !cajeroId || e.pedido_por === cajeroId)
          .map(normalizarEvento)
      } else {
        setAvisoEventos('No se pudo cargar la apertura, el cierre ni la aprobación de operaciones (gestion_caja no respondió). Se muestran solo las ventas.')
      }

      const combinadas = [...ventas, ...eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

      setOperaciones(combinadas)
      setResumen(ventasResultado.value.resumen)
    } catch (err) {
      if (actual !== peticion.current) return
      setOperaciones([])
      setResumen(null)
      setError(obtenerMensajeError(err))
    } finally {
      if (actual === peticion.current) setCargando(false)
    }
  }, [cajeroId, supervisorId, desde, hasta, rangoInvalido])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  const nombreCajero = (() => {
    const c = cajeros.find((item) => String(item.cajero_id) === String(cajeroId))
    return c?.cajero ?? ''
  })()

  const ordenadas = useMemo(() => {
    return orden === 'asc' ? [...operaciones].reverse() : operaciones
  }, [operaciones, orden])

  // Paginacion sobre la lista ya combinada (ventas + eventos de gestion_caja).
  const totalRegistros = ordenadas.length
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const paginacion = { pagina: paginaActual, por_pagina: POR_PAGINA, total_paginas: totalPaginas, total_registros: totalRegistros }
  const visibles = useMemo(
    () => ordenadas.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA),
    [ordenadas, paginaActual]
  )

  const cambiarFiltro = (setter) => (event) => {
    setter(event.target.value)
    setPagina(1)
  }

  const hayFiltros = !rangoInvalido

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Historial de operaciones</h1>
        <p>Consulta las operaciones de los cajeros en un rango de fechas.</p>
      </div>

      <div>
        <div className="adm-filtros">
          <Selector etiqueta="Cajero" value={cajeroId} onChange={cambiarFiltro(setCajeroId)} disabled={cargandoCajeros}>
            <option value="">{cargandoCajeros ? 'Cargando cajeros...' : 'Todos los cajeros'}</option>
            {cajeros.map((c) => (
              <option key={c.cajero_id} value={c.cajero_id}>
                {c.cajero}
              </option>
            ))}
          </Selector>
          <CampoTexto
            etiqueta="Supervisor que autorizó"
            type="text"
            value={supervisorId}
            onChange={cambiarFiltro(setSupervisorId)}
            placeholder="Código del supervisor"
          />
          <CampoTexto
            etiqueta="Desde"
            type="date"
            value={desde}
            max={hasta || undefined}
            onChange={cambiarFiltro(setDesde)}
            required
          />
          <CampoTexto
            etiqueta="Hasta"
            type="date"
            value={hasta}
            min={desde || undefined}
            onChange={cambiarFiltro(setHasta)}
            required
          />
        </div>
        {(rangoInvalido || errorCajeros || supervisorId.trim() || avisoEventos) && (
          <div className="adm-avisos">
            {rangoInvalido && <Alerta tono="error" titulo='La fecha "Desde" no puede ser posterior a "Hasta".' />}
            {errorCajeros && <Alerta tono="error" titulo={`No se pudieron cargar los cajeros: ${errorCajeros}`} />}
            {supervisorId.trim() && (
              <Alerta
                tono="info"
                titulo="Solo las operaciones que necesitaron un supervisor (apertura, cierre, anulación o aprobación) tienen autorizante, así que este filtro solo muestra esas."
              />
            )}
            {avisoEventos && <Alerta tono="advertencia" titulo={avisoEventos} />}
          </div>
        )}
      </div>

      {!hayFiltros && (
        <EstadoVacio titulo="Ajusta las fechas" texto="Elige un rango de fechas válido para ver el historial." />
      )}

      {error && (
        <div className="adm-filtros">
          <Alerta tono="error" titulo="No se pudo cargar el historial">
            {error}
          </Alerta>
          <Boton variante="contorno" onClick={cargarHistorial}>
            Reintentar
          </Boton>
        </div>
      )}

      {hayFiltros && cargando && <EstadoCargando lineas={4} texto="Cargando historial" />}

      {hayFiltros && !cargando && !error && operaciones.length === 0 && (
        <EstadoVacio
          titulo="Sin historial de operaciones"
          texto={`No hay operaciones${nombreCajero ? ` de ${nombreCajero}` : ''} entre ${formatearDia(desde)} y ${formatearDia(hasta)}.`}
        />
      )}

      {hayFiltros && !cargando && !error && operaciones.length > 0 && resumen && (
        <>
          {/* Resumen calculado por el backend */}
          <h2 className="adm-subtitulo">Resumen por día</h2>
          <div className="adm-kpis">
            <TarjetaKpi titulo="Total recaudado" valor={formatearMoneda(resumen.total)} />
            <TarjetaKpi titulo="Ventas" valor={resumen.cantidad_operaciones} />
            <TarjetaKpi titulo="Días con actividad" valor={resumen.por_dia?.length || 0} />
          </div>
          <Tabla etiqueta="Resumen por día">
            <thead>
              <tr>
                <th>Día</th>
                <th className="ui-num">Operaciones</th>
                <th className="ui-num">Total recaudado</th>
              </tr>
            </thead>
            <tbody>
              {resumen.por_dia?.map((d) => (
                <tr key={d.fecha}>
                  <td>{formatearDia(d.fecha)}</td>
                  <td className="ui-num">{d.cantidad_operaciones}</td>
                  <td className="ui-num">{formatearMoneda(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>

          <h2 className="adm-subtitulo">Operaciones</h2>
          <div>
            <Tabla etiqueta="Operaciones">
              <thead>
                <tr>
                  <th aria-sort={orden === 'asc' ? 'ascending' : 'descending'}>
                    <button
                      className="adm-orden"
                      type="button"
                      onClick={() => {
                        setOrden(orden === 'asc' ? 'desc' : 'asc')
                      }}
                    >
                      Fecha y hora <span aria-hidden="true">{orden === 'asc' ? '↑' : '↓'}</span>
                    </button>
                  </th>
                  <th>Método</th>
                  <th className="ui-num">Monto</th>
                  <th>Estado</th>
                  <th>Pedido por</th>
                  <th>Autorizado por</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((op) => (
                  <tr key={op.key}>
                    <td>{formatearFechaHora(op.fecha)}</td>
                    <td>{Array.isArray(op.metodos) ? op.metodos.join(', ') : op.metodos}</td>
                    <td className="ui-num">{op.total == null ? '—' : formatearMoneda(op.total)}</td>
                    <td>
                      <Chip tono={tonoEstado(op.estado)}>{etiquetaEstado(op.estado)}</Chip>
                    </td>
                    <td>{op.pedido_por || '—'}</td>
                    <td
                      title={
                        TIPOS_CON_AUTORIZACION.has(op.estado)
                          ? `Autorizado el ${formatearFechaHora(op.fecha)}`
                          : undefined
                      }
                    >
                      {autorizadoPorMostrar(op)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Tabla>

            <nav className="adm-paginacion adm-paginacion--tabla" aria-label="Paginación">
              <span>
                {paginacion.total_registros === 0 ? 0 : (paginacion.pagina - 1) * paginacion.por_pagina + 1}–
                {Math.min(paginacion.pagina * paginacion.por_pagina, paginacion.total_registros)} de{' '}
                {paginacion.total_registros}
              </span>
              <div>
                <Boton
                  variante="contorno"
                  onClick={() => setPagina(paginacion.pagina - 1)}
                  disabled={paginacion.pagina <= 1}
                >
                  Anterior
                </Boton>
                <span>
                  Página {paginacion.pagina} de {paginacion.total_paginas}
                </span>
                <Boton
                  variante="contorno"
                  onClick={() => setPagina(paginacion.pagina + 1)}
                  disabled={paginacion.pagina >= paginacion.total_paginas}
                >
                  Siguiente
                </Boton>
              </div>
            </nav>
          </div>
        </>
      )}
    </section>
  )
}
