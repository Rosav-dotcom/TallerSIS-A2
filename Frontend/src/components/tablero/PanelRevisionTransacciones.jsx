import { useCallback, useEffect, useRef, useState } from 'react'
import { Alerta, AreaTexto, Boton, CampoTexto, Chip, Modal, Selector, Tabla, TarjetaKpi } from '../ui'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const REVISION_BASE_URL = `${BASE_URL}/api/pagos/revision`
const CAJEROS_URL = `${REVISION_BASE_URL}/cajeros`
const TRANSACCIONES_URL = `${REVISION_BASE_URL}/transacciones`
const RESUMEN_URL = `${REVISION_BASE_URL}/resumen`
const revisionUrl = (id) => `${TRANSACCIONES_URL}/${id}`
const POR_PAGINA = 10

const fechaHoy = () => {
  const hoy = new Date()
  const offset = hoy.getTimezoneOffset()
  return new Date(hoy.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

const formatearMoneda = (valor) =>
  new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(Number(valor) || 0)

const formatearHora = (valor) => {
  if (!valor) return '—'
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return String(valor)
  return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const obtenerMensajeError = (error) => {
  const status = error?.status
  if (status === 404) return 'No se encontró la transacción solicitada.'
  if (status === 502 || status === 503) return 'El servicio no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo completar la operación.'
  return 'No se pudo conectar con el servidor. Verifique su conexión.'
}

// Estados del backend: PENDIENTE (sin revisar), REVISADA, OBSERVADA
const ESTADOS = {
  PENDIENTE: { etiqueta: 'Sin revisar', clase: 'rt-estado-sin-revisar' },
  REVISADA: { etiqueta: 'Revisada', clase: 'rt-estado-revisada' },
  OBSERVADA: { etiqueta: 'Observada', clase: 'rt-estado-observada' },
}

const idTx = (t) => t?.id_transaccion
const estadoTx = (t) => t?.revision?.estado || 'PENDIENTE'
const notaTx = (t) => t?.revision?.nota || ''

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

export default function PanelRevisionTransacciones() {
  const [cajeros, setCajeros] = useState([])
  const [cargandoCajeros, setCargandoCajeros] = useState(true)
  const [errorCajeros, setErrorCajeros] = useState('')
  const [cajeroId, setCajeroId] = useState('')
  const [fecha, setFecha] = useState(fechaHoy)

  const [transacciones, setTransacciones] = useState([])
  const [resumen, setResumen] = useState(null)
  const [paginacion, setPaginacion] = useState({ pagina: 1, total_paginas: 1, total_registros: 0 })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [metodo, setMetodo] = useState('')
  const [pagina, setPagina] = useState(1)

  const [seleccion, setSeleccion] = useState(null)
  const [estadoNuevo, setEstadoNuevo] = useState('REVISADA')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')
  const [exito, setExito] = useState('')

  const peticionTx = useRef(0)

  // 1. Cargar lista de cajeros que tuvieron ventas en la fecha seleccionada
  useEffect(() => {
    let activo = true
    ;(async () => {
      setCargandoCajeros(true)
      try {
        const res = await requestJson(`${CAJEROS_URL}?fecha=${fecha}`)
        const datos = res?.data ?? res
        if (activo) setCajeros(Array.isArray(datos) ? datos : datos?.cajeros ?? [])
      } catch (err) {
        if (activo) setErrorCajeros(obtenerMensajeError(err))
      } finally {
        if (activo) setCargandoCajeros(false)
      }
    })()
    return () => { activo = false }
  }, [fecha])

  // 2. Cargar transacciones (paginadas y filtradas desde el backend)
  const cargarTransacciones = useCallback(async () => {
    if (!cajeroId || !fecha) {
      setTransacciones([])
      return
    }
    const actual = ++peticionTx.current
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams({ cajero_id: cajeroId, fecha, pagina, por_pagina: POR_PAGINA })
      if (metodo) params.append('metodo', metodo)

      const res = await requestJson(`${TRANSACCIONES_URL}?${params}`)
      if (actual !== peticionTx.current) return
      const datos = res?.data ?? res
      setTransacciones(datos.transacciones ?? [])
      setPaginacion(datos.paginacion ?? { pagina: 1, total_paginas: 1, total_registros: 0 })
    } catch (err) {
      if (actual !== peticionTx.current) return
      setTransacciones([])
      setError(obtenerMensajeError(err))
    } finally {
      if (actual === peticionTx.current) setCargando(false)
    }
  }, [cajeroId, fecha, metodo, pagina])

  useEffect(() => {
    cargarTransacciones()
  }, [cargarTransacciones])

  // 3. Cargar el resumen general del cajero (independiente de la paginación)
  const cargarResumen = useCallback(async () => {
    if (!cajeroId || !fecha) {
      setResumen(null)
      return
    }
    try {
      const res = await requestJson(`${RESUMEN_URL}?cajero_id=${cajeroId}&fecha=${fecha}`)
      setResumen(res?.data ?? res)
    } catch (err) {
      setResumen(null)
    }
  }, [cajeroId, fecha])

  useEffect(() => {
    cargarResumen()
  }, [cargarResumen])

  const cajeroSeleccionado = cajeros.find((c) => String(c.cajero_id) === String(cajeroId))
  const nombreCajero = cajeroSeleccionado?.cajero ?? ''

  const cambiarCajero = (valor) => {
    setCajeroId(valor)
    setMetodo('')
    setPagina(1)
    setExito('')
  }

  const cambiarFecha = (valor) => {
    setFecha(valor)
    setMetodo('')
    setPagina(1)
    setExito('')
  }

  const abrirRevision = (transaccion) => {
    const estadoActual = estadoTx(transaccion)
    setSeleccion(transaccion)
    setEstadoNuevo(estadoActual === 'OBSERVADA' ? 'OBSERVADA' : 'REVISADA')
    setNota(notaTx(transaccion))
    setErrorModal('')
    setExito('')
  }

  const guardarRevision = async (event) => {
    event.preventDefault()
    const notaLimpia = nota.trim()

    if (estadoNuevo === 'OBSERVADA' && !notaLimpia) {
      setErrorModal('La nota es obligatoria para marcar la transacción como observada.')
      return
    }

    const id = idTx(seleccion)
    setGuardando(true)
    setErrorModal('')
    try {
      // Usamos PUT como indica revisionRoutes.js
      const res = await requestJson(revisionUrl(id), {
        method: 'PUT',
        body: JSON.stringify({ estado: estadoNuevo, nota: notaLimpia || null, revisado_por: 'admin' }),
      })
      const actualizado = res?.data ?? res

      // Actualizamos la fila en la tabla sin recargar la página
      setTransacciones((previas) =>
        previas.map((t) =>
          idTx(t) === id
            ? { ...t, revision: { estado: actualizado.estado, nota: actualizado.nota, revisado_por: actualizado.revisado_por } }
            : t
        )
      )
      setExito(`Transacción #${id} marcada como ${ESTADOS[estadoNuevo].etiqueta.toLowerCase()}.`)
      setSeleccion(null)
      // Refrescamos el resumen para actualizar los contadores
      cargarResumen()
    } catch (err) {
      setErrorModal(obtenerMensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="tab-panel">
      <div className="tab-cabecera">
        <div>
          <h2>Transacciones por cajero</h2>
          <p>Mira lo que hizo cada cajero, cualquier día, y marca lo que necesite una nota.</p>
        </div>
      </div>

      <div>
        <div className="tab-filtros">
          <Selector
            etiqueta="Cajero"
            value={cajeroId}
            onChange={(e) => cambiarCajero(e.target.value)}
            disabled={cargandoCajeros}
          >
            <option value="">{cargandoCajeros ? 'Cargando cajeros...' : 'Selecciona un cajero'}</option>
            {cajeros.map((c) => (
              <option key={c.cajero_id} value={c.cajero_id}>
                {c.cajero}
              </option>
            ))}
          </Selector>
          <CampoTexto
            etiqueta="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => cambiarFecha(e.target.value)}
            required
          />
          <Selector
            etiqueta="Método de pago"
            value={metodo}
            onChange={(e) => {
              setMetodo(e.target.value)
              setPagina(1)
            }}
            disabled={!resumen}
          >
            <option value="">Todos</option>
            {resumen?.por_metodo?.map((m) => (
              <option key={m.metodo} value={m.metodo}>
                {m.metodo}
              </option>
            ))}
          </Selector>
        </div>
        {errorCajeros && (
          <div className="tab-filtros-avisos">
            <Alerta tono="error" titulo={`No se pudieron cargar los cajeros: ${errorCajeros}`} />
          </div>
        )}
      </div>

      {!cajeroId && (
        <Alerta tono="info" titulo="Selecciona un cajero">
          Elige un cajero y una fecha para ver sus transacciones en una ventana emergente.
        </Alerta>
      )}

      {/* Al elegir un cajero, sus transacciones se muestran en una ventana emergente
          (antes quedaban mas abajo en la pagina y habia que bajar a verlas).
          Mientras se revisa una transacción, esta ventana no se cierra con Escape. */}
      {cajeroId && (
        <Modal
          abierto
          ancho
          titulo={`Transacciones de ${nombreCajero || 'cajero'}`}
          onCerrar={seleccion ? undefined : () => cambiarCajero('')}
        >
          <div className="tab-form">
            {exito && <Alerta tono="exito" titulo={exito} />}

            {error && (
              <div className="tab-filtros">
                <Alerta tono="error" titulo="No se pudieron cargar las transacciones">
                  {error}
                </Alerta>
                <Boton variante="contorno" onClick={cargarTransacciones}>
                  Reintentar
                </Boton>
              </div>
            )}

            {cargando && (
              <div className="tab-form" aria-live="polite" aria-label="Cargando transacciones">
                {[1, 2, 3, 4].map((i) => (
                  <div className="tab-cargando tab-cargando--fila" key={i} />
                ))}
              </div>
            )}

            {!cargando && !error && (
              <>
                <div className="tab-kpis" aria-label="Resumen del cajero">
                  <TarjetaKpi titulo={`${nombreCajero || 'Cajero'} · ${fecha}`} valor={formatearMoneda(resumen?.total)}>
                    <span className="tab-kpi-detalle">
                      {resumen?.cantidad_transacciones || 0}{' '}
                      {resumen?.cantidad_transacciones === 1 ? 'transacción' : 'transacciones'}
                    </span>
                  </TarjetaKpi>
                  <TarjetaKpi titulo="Sin revisar" valor={resumen?.revision?.sin_revisar || 0} />
                  <TarjetaKpi titulo="Revisadas" valor={resumen?.revision?.revisadas || 0} />
                  <TarjetaKpi titulo="Observadas" valor={resumen?.revision?.observadas || 0} />
                </div>

                {transacciones.length === 0 ? (
                  <Alerta tono="info" titulo="Sin transacciones">
                    {metodo
                      ? `No hay transacciones con el método "${metodo}" para esta fecha.`
                      : 'Este cajero no registró transacciones en la fecha seleccionada.'}
                  </Alerta>
                ) : (
                  <div>
                    <Tabla etiqueta="Transacciones del cajero">
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Método</th>
                          <th className="ui-num">Monto</th>
                          <th>Estado de revisión</th>
                          <th aria-label="Acciones" />
                        </tr>
                      </thead>
                      <tbody>
                        {transacciones.map((t) => {
                          const clave = estadoTx(t)
                          const { etiqueta } = ESTADOS[clave]
                          const notaActual = notaTx(t)
                          return (
                            <tr key={idTx(t)}>
                              <td>{formatearHora(t.hora ?? t.fecha)}</td>
                              <td>{Array.isArray(t.metodos) ? t.metodos.join(', ') : t.metodos}</td>
                              <td className="ui-num">{formatearMoneda(t.total)}</td>
                              <td>
                                <Chip
                                  tono={
                                    clave === 'REVISADA' ? 'exito' : clave === 'OBSERVADA' ? 'error' : 'advertencia'
                                  }
                                >
                                  {etiqueta}
                                </Chip>
                                {clave === 'OBSERVADA' && notaActual && (
                                  <span className="tab-detalle">{notaActual}</span>
                                )}
                              </td>
                              <td>
                                <div className="tab-acciones">
                                  <Boton variante="fantasma" onClick={() => abrirRevision(t)}>
                                    {clave === 'PENDIENTE' ? 'Agregar nota' : 'Cambiar'}
                                  </Boton>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </Tabla>

                    <nav className="tab-paginacion" aria-label="Paginación">
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
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {seleccion && (
        <Modal
          abierto
          titulo={`Revisar transacción ${idTx(seleccion) != null ? `#${idTx(seleccion)}` : ''}`}
          onCerrar={guardando ? undefined : () => setSeleccion(null)}
        >
          <form className="tab-form" onSubmit={guardarRevision}>
            <p className="tab-nota">
              {formatearHora(seleccion.hora ?? seleccion.fecha)} ·{' '}
              {Array.isArray(seleccion.metodos) ? seleccion.metodos.join(', ') : seleccion.metodos} ·{' '}
              {formatearMoneda(seleccion.total)}
            </p>

            <fieldset className="tab-opciones">
              <legend>Resultado de la revisión</legend>
              <label className={estadoNuevo === 'REVISADA' ? 'tab-opcion tab-opcion--activa' : 'tab-opcion'}>
                <input
                  type="radio"
                  name="estado"
                  value="REVISADA"
                  checked={estadoNuevo === 'REVISADA'}
                  onChange={() => {
                    setEstadoNuevo('REVISADA')
                    setErrorModal('')
                  }}
                />
                Revisada
              </label>
              <label className={estadoNuevo === 'OBSERVADA' ? 'tab-opcion tab-opcion--activa' : 'tab-opcion'}>
                <input
                  type="radio"
                  name="estado"
                  value="OBSERVADA"
                  checked={estadoNuevo === 'OBSERVADA'}
                  onChange={() => {
                    setEstadoNuevo('OBSERVADA')
                    setErrorModal('')
                  }}
                />
                Observada
              </label>
            </fieldset>

            <AreaTexto
              etiqueta={`Nota ${estadoNuevo === 'OBSERVADA' ? '(obligatoria)' : '(opcional)'}`}
              rows={3}
              value={nota}
              onChange={(e) => {
                setNota(e.target.value)
                setErrorModal('')
              }}
              placeholder={
                estadoNuevo === 'OBSERVADA'
                  ? 'Explica por qué se observa esta transacción'
                  : 'Agrega un comentario si lo necesitas'
              }
            />

            {errorModal && <Alerta tono="error" titulo={errorModal} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={() => setSeleccion(null)} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
