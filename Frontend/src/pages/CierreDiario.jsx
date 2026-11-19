import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  Alerta,
  Boton,
  CampoTexto,
  Chip,
  EstadoCargando,
  EstadoVacio,
  Modal,
  Tabla,
  Tarjeta,
  TarjetaKpi,
} from '../components/ui'
import './turno.css'
import './admin.css'

const BASE_URL = import.meta.env.VITE_PAGOS_PROVEEDORES_API_BASE_URL || 'http://localhost:4006'
const API_URL = `${BASE_URL}/api/lotes-cierre`
// TDSI-22 / TDSI-122: endpoints para el microservicio de envíos a Contabilidad
const ENVIOS_URL = `${BASE_URL}/api/envios-contabilidad`
const reenviarUrl = (id) => `${ENVIOS_URL}/${id}/reenviar`

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

const obtenerMensajeError = (error) => {
  const status = error?.status ?? error?.response?.status
  if (status === 422) return 'Periodo contable cerrado'
  if (status === 503) return 'Contabilidad no disponible'
  if (status === 502) return 'Gestión de pagos no disponible'
  return error?.message || 'No se pudo completar la operación. Verifique su conexión e inténtelo nuevamente.'
}

// TDSI-22: normaliza el estado del envío a Enviado / Pendiente / Error
const ESTADOS_ENVIO = {
  ENVIADO: { etiqueta: 'Enviado', clase: 'envio-estado-enviado' },
  PENDIENTE: { etiqueta: 'Pendiente', clase: 'envio-estado-pendiente' },
  ERROR: { etiqueta: 'Error', clase: 'envio-estado-error' },
}

const normalizarEstadoEnvio = (valor) => {
  const v = String(valor || '').toUpperCase()
  if (['ENVIADO', 'ENVIADA', 'EXITO', 'OK'].includes(v)) return 'ENVIADO'
  if (['ERROR', 'FALLIDO', 'FALLIDA'].includes(v)) return 'ERROR'
  return 'PENDIENTE'
}

const idEnvio = (envio) => envio?.id ?? envio?.id_envio

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // Algunas respuestas de error pueden no traer JSON.
  }

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

export default function CierreDiario() {
  const [fecha, setFecha] = useState(fechaHoy)
  const [lote, setLote] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [loteExistente, setLoteExistente] = useState(null)
  const [modalExistente, setModalExistente] = useState(false)

  // TDSI-22: envíos a Contabilidad
  const [envios, setEnvios] = useState([])
  const [cargandoEnvios, setCargandoEnvios] = useState(false)
  const [errorEnvios, setErrorEnvios] = useState('')
  const [reenviandoId, setReenviandoId] = useState(null)
  const [mensajeEnvio, setMensajeEnvio] = useState(null) // { tipo: 'exito' | 'error', texto }

  const cargarEnvios = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setCargandoEnvios(true)
    setErrorEnvios('')
    try {
      const res = await requestJson(ENVIOS_URL)
      const datos = res?.data ?? res
      const lista = Array.isArray(datos) ? datos : datos?.envios ?? []
      setEnvios(lista)
    } catch (err) {
      setErrorEnvios(obtenerMensajeError(err))
    } finally {
      setCargandoEnvios(false)
    }
  }, [])

  useEffect(() => {
    cargarEnvios()
  }, [cargarEnvios])

  const reenviarEnvio = async (envio) => {
    const id = idEnvio(envio)
    setReenviandoId(id)
    setMensajeEnvio(null)
    try {
      await requestJson(reenviarUrl(id), {
        method: 'POST',
        body: JSON.stringify({ solicitado_por: 'admin' }),
      })
      setMensajeEnvio({ tipo: 'exito', texto: `El envío #${id} fue reenviado a Contabilidad.` })
      // Refresca la lista para reflejar el nuevo estado
      await cargarEnvios({ silencioso: true })
    } catch (err) {
      setMensajeEnvio({ tipo: 'error', texto: `No se pudo reenviar el envío #${id}: ${obtenerMensajeError(err)}` })
    } finally {
      setReenviandoId(null)
    }
  }

  const verLoteExistente = async (loteRecibido) => {
    if (loteRecibido && typeof loteRecibido === 'object' && (loteRecibido.id != null || loteRecibido.id_lote != null)) {
      setLote(loteRecibido)
      setModalExistente(false)
      setError('')
      setExito('')
      return
    }

    setIsLoading(true)
    setError('')
    try {
      // El backend consulta por GET /:fecha
      const res = await requestJson(`${API_URL}/${fecha}`)
      const encontrado = res?.data ?? res
      if (!encontrado) {
        setError('El servidor indicó que existe un lote, pero no devolvió sus datos. Verifique el endpoint de consulta.')
        return
      }
      setLote(encontrado)
      setModalExistente(false)
    } catch (err) {
      setError(obtenerMensajeError(err))
    } finally {
      setIsLoading(false)
    }
  }

  const generarLote = async (event) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setExito('')
    setModalExistente(false)
    setLoteExistente(null)

    try {
      // El backend crea el lote con POST /
      const res = await requestJson(API_URL, {
        method: 'POST',
        body: JSON.stringify({ fecha, generado_por: 'admin' }),
      })

      const resultado = res?.data ?? res
      setLote(resultado)
      setExito('Lote de cierre diario generado correctamente.')
      // TDSI-22: el lote nuevo genera un envío a Contabilidad, refrescamos la tabla
      cargarEnvios({ silencioso: true })
    } catch (err) {
      // 409: La fecha ya tiene lote
      if (err.status === 409 || err.data?.existente || err.data?.yaExiste) {
        const existente = err.data?.detalle?.lote ?? err.data?.data ?? null
        setLoteExistente(existente)
        setModalExistente(true)
      } else {
        setError(obtenerMensajeError(err))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const dinero = (valor) => formatearMoneda(valor)
  const estado = (lote?.estado || 'GENERADO').toUpperCase()

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Cierre diario</h1>
        <p>Consolida los movimientos financieros del día y genera el lote para su integración con el ERP.</p>
      </div>

      <Tarjeta titulo="Generación de lote">
        <div className="adm-form">
          <p className="adm-nota">Selecciona la fecha contable que deseas procesar.</p>
          <form className="adm-filtros" onSubmit={generarLote}>
            <CampoTexto
              etiqueta="Fecha del cierre"
              type="date"
              value={fecha}
              onChange={(event) => {
                setFecha(event.target.value)
                setError('')
                setExito('')
                setModalExistente(false)
              }}
              required
              aria-label="Fecha del cierre diario"
            />
            <Boton type="submit" disabled={isLoading || !fecha}>
              {isLoading ? 'Procesando...' : 'Generar lote'}
            </Boton>
          </form>
        </div>
      </Tarjeta>

      {isLoading && <EstadoCargando texto="Consultando información del cierre..." />}

      {error && (
        <Alerta tono="error" titulo={error}>
          {error === 'Periodo contable cerrado' &&
            'La generación fue bloqueada. Selecciona otra fecha con periodo contable abierto o contacta a Contabilidad.'}
          {error === 'Contabilidad no disponible' &&
            'No se generó ningún lote. Inténtalo más tarde o contacta al equipo de soporte.'}
        </Alerta>
      )}

      {exito && <Alerta tono="exito" titulo={exito} />}

      {lote && !isLoading && (
        <Tarjeta
          titulo="Resumen financiero"
          acciones={<Chip tono={estado === 'GENERADO' ? 'exito' : 'neutro'}>{estado}</Chip>}
        >
          <div className="adm-form">
            <p className="adm-nota">Detalle consolidado del lote de cierre diario.</p>

            <dl className="adm-datos">
              <div>
                <dt>Fecha del lote</dt>
                <dd>{lote.fecha || fecha}</dd>
              </div>
              <div>
                <dt>Identificador del lote</dt>
                <dd>{lote.id != null || lote.id_lote != null ? `#${lote.id ?? lote.id_lote}` : 'No informado'}</dd>
              </div>
            </dl>

            <div className="adm-kpis">
              <TarjetaKpi titulo="Total ingresos" valor={dinero(lote.ingresos ?? lote.total_ingresos)}>
                <span className="adm-kpi-detalle">Entradas consolidadas</span>
              </TarjetaKpi>
              <TarjetaKpi titulo="Total egresos" valor={dinero(lote.egresos ?? lote.total_egresos)}>
                <span className="adm-kpi-detalle">Salidas consolidadas</span>
              </TarjetaKpi>
              <TarjetaKpi titulo="Total impuestos" valor={dinero(lote.impuestos ?? lote.total_impuestos)}>
                <span className="adm-kpi-detalle">Impuestos del periodo</span>
              </TarjetaKpi>
              <TarjetaKpi
                titulo="Total neto"
                valor={dinero(
                  lote.neto ??
                    lote.total_neto ??
                    (Number(lote.ingresos ?? lote.total_ingresos) || 0) -
                      (Number(lote.egresos ?? lote.total_egresos) || 0),
                )}
              >
                <span className="adm-kpi-detalle">Ingresos menos egresos</span>
              </TarjetaKpi>
            </div>
            <p className="adm-nota">Los importes se muestran en bolivianos (BOB).</p>
          </div>
        </Tarjeta>
      )}

      {/* TDSI-22: Envíos a Contabilidad */}
      <Tarjeta
        titulo="Envíos a Contabilidad"
        acciones={
          <Boton
            variante="contorno"
            icono={RefreshCw}
            onClick={() => cargarEnvios()}
            disabled={cargandoEnvios || reenviandoId != null}
          >
            {cargandoEnvios ? 'Actualizando...' : 'Actualizar'}
          </Boton>
        }
      >
        <div className="adm-form">
          <p className="adm-nota">
            Reportes de ingresos, egresos e impuestos enviados para la creación de asientos contables.
          </p>

          {mensajeEnvio && (
            <Alerta tono={mensajeEnvio.tipo === 'exito' ? 'exito' : 'error'} titulo={mensajeEnvio.texto} />
          )}

          {cargandoEnvios && envios.length === 0 && <EstadoCargando texto="Cargando envíos..." />}

          {errorEnvios && (
            <Alerta tono="error" titulo="No se pudieron cargar los envíos">
              {errorEnvios}
            </Alerta>
          )}

          {!cargandoEnvios && !errorEnvios && envios.length === 0 && (
            <EstadoVacio
              titulo="Sin envíos registrados"
              texto="Cuando se genere un lote de cierre, su envío a Contabilidad aparecerá aquí."
            />
          )}

          {envios.length > 0 && (
            <Tabla etiqueta="Envíos a Contabilidad">
              <thead>
                <tr>
                  <th>Envío</th>
                  <th>Lote</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {envios.map((envio, indice) => {
                  const id = idEnvio(envio)
                  const clave = normalizarEstadoEnvio(envio.estado)
                  const { etiqueta } = ESTADOS_ENVIO[clave]
                  const idLote = envio.id_lote ?? envio.lote_id
                  const fechaEnvio = envio.fecha ?? envio.fecha_lote ?? envio.fecha_envio
                  const reenviando = reenviandoId === id

                  return (
                    <tr key={id ?? indice}>
                      <td>{id != null ? `#${id}` : '—'}</td>
                      <td>{idLote != null ? `#${idLote}` : '—'}</td>
                      <td>{fechaEnvio ? String(fechaEnvio).slice(0, 10) : '—'}</td>
                      <td>
                        <Chip tono={clave === 'ENVIADO' ? 'exito' : clave === 'ERROR' ? 'error' : 'advertencia'}>
                          {etiqueta}
                        </Chip>
                        {clave === 'ERROR' && (envio.mensaje_error ?? envio.ultimo_error) && (
                          <span className="adm-detalle adm-accion--peligro">
                            {envio.mensaje_error ?? envio.ultimo_error}
                          </span>
                        )}
                      </td>
                      <td>
                        {clave === 'ERROR' && (
                          <div className="adm-acciones">
                            <Boton
                              variante="fantasma"
                              onClick={() => reenviarEnvio(envio)}
                              disabled={reenviandoId != null}
                            >
                              {reenviando ? 'Reenviando...' : 'Reenviar'}
                            </Boton>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabla>
          )}
        </div>
      </Tarjeta>

      {modalExistente && (
        <Modal
          abierto
          titulo="Ya existe un lote generado para esta fecha"
          onCerrar={() => setModalExistente(false)}
          acciones={
            <>
              <Boton variante="contorno" onClick={() => setModalExistente(false)}>
                Cancelar
              </Boton>
              <Boton onClick={() => verLoteExistente(loteExistente)} disabled={isLoading}>
                {isLoading ? 'Consultando...' : 'Ver lote existente'}
              </Boton>
            </>
          }
        >
          <p>La fecha seleccionada ya fue procesada. Puedes consultar el lote registrado sin generar uno nuevo.</p>
        </Modal>
      )}
    </section>
  )
}
