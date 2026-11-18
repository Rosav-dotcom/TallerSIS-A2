import { useCallback, useEffect, useRef, useState } from 'react'
import { Alerta, Boton, Chip } from '../ui'

const BASE_URL = import.meta.env.VITE_GESTION_PAGOS_API_BASE_URL || 'http://localhost:4005'
const MONITOREO_URL = `${BASE_URL}/api/pagos/monitoreo`
const INTERVALO_MS = 10_000
const MAX_OPERACIONES = 5

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
  if (status === 502) return 'El servicio de monitoreo no está disponible.'
  if (status === 503) return 'El servicio de monitoreo no está disponible por el momento.'
  if (status) return error?.message || 'No se pudo obtener la información de los cajeros.'
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
  } catch {
    // respuesta sin cuerpo JSON
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

export default function PanelMonitoreoCajeros() {
  const [cajeros, setCajeros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [actualizado, setActualizado] = useState(null)
  const enCurso = useRef(false)

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (enCurso.current) return
    enCurso.current = true
    if (!silencioso) setCargando(true)
    try {
      const res = await requestJson(MONITOREO_URL)
      const datos = res?.data ?? res
      const lista = Array.isArray(datos) ? datos : datos?.cajeros ?? []
      setCajeros(lista)
      setError('')
      setActualizado(new Date())
    } catch (err) {
      setError(obtenerMensajeError(err))
    } finally {
      enCurso.current = false
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const temporizador = setInterval(() => cargar({ silencioso: true }), INTERVALO_MS)
    return () => clearInterval(temporizador)
  }, [cargar])

  return (
    <section className="tab-panel">
      <div className="tab-cabecera">
        <div>
          <h2>Monitoreo de cajeros</h2>
          <p>Actividad en tiempo real de cada punto de venta activo.</p>
        </div>
        <div className="tab-cajero" aria-live="polite">
          <Chip tono={error ? 'error' : 'exito'}>{error ? 'Sin conexión' : 'En vivo'}</Chip>
          <span className="tab-detalle">
            {actualizado ? `Actualizado ${formatearHora(actualizado)}` : 'Esperando datos...'} · cada{' '}
            {INTERVALO_MS / 1000} s
          </span>
        </div>
      </div>

      {/* Alerta de error de conexión */}
      {error && (
        <div className="tab-filtros">
          <Alerta tono="error" titulo={error}>
            {cajeros.length > 0
              ? 'Se muestran los últimos datos recibidos. Se reintentará automáticamente.'
              : 'Se reintentará automáticamente.'}
          </Alerta>
          <Boton variante="contorno" onClick={() => cargar()}>
            Reintentar
          </Boton>
        </div>
      )}

      {cargando && cajeros.length === 0 && (
        <div className="tab-rejilla" aria-live="polite" aria-label="Cargando cajeros">
          {[1, 2, 3].map((item) => (
            <div className="tab-cargando" key={item} />
          ))}
        </div>
      )}

      {!cargando && !error && cajeros.length === 0 && (
        <Alerta tono="info" titulo="No hay cajeros activos">
          Cuando un cajero registre operaciones, aparecerá aquí.
        </Alerta>
      )}

      {cajeros.length > 0 && (
        <div className="tab-rejilla">
          {cajeros.map((cajero, indice) => {
            const operaciones = cajero.operaciones ?? cajero.ultimas_operaciones ?? []
            const cantidad = cajero.cantidad_operaciones ?? cajero.cantidad ?? operaciones.length
            const total =
              cajero.total_acumulado ??
              cajero.total ??
              operaciones.reduce((suma, op) => suma + (Number(op.monto) || 0), 0)

            const ultima = cajero.ultima_operacion?.hora ?? operaciones[0]?.hora

            const nombre = cajero.cajero ?? cajero.nombre ?? `Cajero ${cajero.id ?? cajero.cajero_id ?? indice + 1}`

            return (
              <article className="tab-ficha" key={cajero.id ?? cajero.cajero_id ?? indice}>
                <header className="tab-cajero">
                  <span className="tab-avatar" aria-hidden="true">
                    {String(nombre).charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h3 className="tab-cajero-nombre">{nombre}</h3>
                    <span className="tab-detalle">Última operación: {ultima ? formatearHora(ultima) : '—'}</span>
                  </div>
                </header>

                <dl className="tab-datos">
                  <div>
                    <dt>Operaciones</dt>
                    <dd>{cantidad}</dd>
                  </div>
                  <div className="tab-datos-total">
                    <dt>Total cobrado</dt>
                    <dd>{formatearMoneda(total)}</dd>
                  </div>
                </dl>

                <div>
                  <span className="ui-campo-etiqueta">Últimas operaciones</span>
                  {operaciones.length === 0 ? (
                    <p className="tab-nota">Sin operaciones registradas</p>
                  ) : (
                    <ul className="tab-datos">
                      {operaciones.slice(0, MAX_OPERACIONES).map((op, i) => {
                        const textoMetodos = Array.isArray(op.metodos)
                          ? op.metodos.join(', ')
                          : (op.metodo ?? op.metodo_pago ?? '—')

                        return (
                          <li key={op.id_transaccion ?? op.id ?? i}>
                            <span>
                              {formatearHora(op.hora ?? op.fecha ?? op.created_at)}
                              <span className="tab-detalle">{textoMetodos}</span>
                            </span>
                            <strong>{formatearMoneda(op.monto)}</strong>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
