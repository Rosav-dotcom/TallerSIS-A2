import { useEffect, useMemo, useState } from 'react'
import { listarDiferencias, resolverDiferencia, reenviarDiferenciaContabilidad } from '../api/caja.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { Alerta, AreaTexto, Boton, Chip, EstadoVacio, Modal, Selector, Tabla } from '../components/ui'
import './turno.css'
import './admin.css'

const ETIQUETA_TIPO = { FALTANTE: 'Faltante', SOBRANTE: 'Sobrante' }

const FILTROS_ESTADO = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'PENDIENTE', etiqueta: 'Pendientes' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
]

// "SinEnviar" = resuelta pero Contabilidad todavia no confirmo nada publicado con exito
// (el envio quedo en Pendiente por un error al publicar).
const FILTROS_CONTABILIDAD = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'Error', etiqueta: 'Error al enviar' },
  { valor: 'Enviado', etiqueta: 'Enviado' },
  { valor: 'Confirmado', etiqueta: 'Confirmado' },
  { valor: 'Rechazado', etiqueta: 'Rechazado' },
]

// TDSI-52: a partir del estado crudo del envio (y si tiene ultimo_error) se arma lo
// que el Administrador necesita ver: una etiqueta visual + si corresponde "Reenviar".
function estadoContabilidad(contabilidad) {
  if (!contabilidad) return null
  const esError = contabilidad.estado === 'Pendiente' && contabilidad.ultimo_error
  return {
    etiqueta: esError ? 'Error' : contabilidad.estado,
    clase: esError || contabilidad.estado === 'Rechazado' ? 'badge-comparacion--faltante' : contabilidad.estado === 'Confirmado' ? 'badge-comparacion--cuadra' : 'badge-estado',
    motivo: esError ? contabilidad.ultimo_error : contabilidad.motivo_rechazo,
    puedeReenviar: contabilidad.estado === 'Pendiente' || contabilidad.estado === 'Rechazado',
    filtroValor: esError ? 'Error' : contabilidad.estado,
  }
}

function DiferenciasCaja() {
  const { administrador } = useAdminAuth()

  const [diferencias, setDiferencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroContabilidad, setFiltroContabilidad] = useState('')

  const [mensaje, setMensaje] = useState(null) // { ok, texto } | null

  const [seleccionada, setSeleccionada] = useState(null)
  const [justificacion, setJustificacion] = useState('')
  const [resolviendo, setResolviendo] = useState(false)
  const [errorResolver, setErrorResolver] = useState(null)

  const [reenviandoId, setReenviandoId] = useState(null)
  const [errorReenviar, setErrorReenviar] = useState(null) // { id, mensaje } | null

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarDiferencias({ estado: filtroEstado || undefined })
      .then((r) => vigente && setDiferencias(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [filtroEstado, recargar])

  const diferenciasFiltradas = useMemo(() => {
    if (!filtroContabilidad) return diferencias
    return diferencias.filter((d) => estadoContabilidad(d.contabilidad)?.filtroValor === filtroContabilidad)
  }, [diferencias, filtroContabilidad])

  function abrirResolver(diferencia) {
    setSeleccionada(diferencia)
    setJustificacion('')
    setErrorResolver(null)
    setMensaje(null)
  }

  function cerrarResolver() {
    setSeleccionada(null)
  }

  async function confirmarResolver(event) {
    event.preventDefault()
    if (!justificacion.trim()) {
      setErrorResolver('La justificación es obligatoria.')
      return
    }
    setResolviendo(true)
    setErrorResolver(null)
    try {
      const { data } = await resolverDiferencia(seleccionada.id, {
        justificacion: justificacion.trim(),
        resuelta_por: administrador?.nombre,
      })
      setMensaje({
        ok: true,
        texto: data.contabilidad?.publicado
          ? 'Diferencia resuelta y enviada a Contabilidad.'
          : 'Diferencia resuelta, pero no se pudo enviar a Contabilidad todavía (podés reintentarlo con "Reenviar").',
      })
      setSeleccionada(null)
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorResolver(err.mensaje || err.message)
    } finally {
      setResolviendo(false)
    }
  }

  async function reenviar(id) {
    setReenviandoId(id)
    setErrorReenviar(null)
    try {
      await reenviarDiferenciaContabilidad(id)
      setMensaje({ ok: true, texto: 'Reenviado a Contabilidad.' })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorReenviar({ id, mensaje: err.mensaje || err.message })
    } finally {
      setReenviandoId(null)
    }
  }

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Diferencias de caja</h1>
        <p>Faltantes y sobrantes detectados al cerrar turnos, y el aviso enviado a Contabilidad al resolverlos.</p>
      </div>

      <div className="adm-filtros">
        <Selector etiqueta="Estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          {FILTROS_ESTADO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector
          etiqueta="Contabilidad"
          value={filtroContabilidad}
          onChange={(e) => setFiltroContabilidad(e.target.value)}
        >
          {FILTROS_CONTABILIDAD.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
      </div>

      {mensaje && <Alerta tono={mensaje.ok ? 'exito' : 'error'} titulo={mensaje.texto} />}

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && diferenciasFiltradas.length === 0 && (
        <EstadoVacio titulo="No hay diferencias que coincidan con los filtros." />
      )}

      {!cargando && !error && diferenciasFiltradas.length > 0 && (
        <Tabla etiqueta="Diferencias de caja">
          <thead>
            <tr>
              <th>Turno</th>
              <th>Caja</th>
              <th>Cajero</th>
              <th>Tipo</th>
              <th className="ui-num">Monto (Bs.)</th>
              <th>Estado</th>
              <th>Justificación</th>
              <th>Contabilidad</th>
              <th aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {diferenciasFiltradas.map((d) => {
              const contab = estadoContabilidad(d.contabilidad)
              return (
                <tr key={d.id}>
                  <td>{d.turno_id}</td>
                  <td>{d.caja_id}</td>
                  <td>{d.cajero || '—'}</td>
                  <td>
                    <Chip>{ETIQUETA_TIPO[d.tipo] ?? d.tipo}</Chip>
                  </td>
                  <td className={`ui-num adm-diferencia--${d.tipo?.toLowerCase()}`}>{Math.abs(d.monto).toFixed(2)}</td>
                  <td>
                    <Chip tono={d.estado === 'RESUELTA' ? 'exito' : 'advertencia'}>
                      {d.estado === 'RESUELTA' ? 'Resuelta' : 'Pendiente'}
                    </Chip>
                  </td>
                  <td>{d.justificacion || '—'}</td>
                  <td>
                    {contab ? (
                      <>
                        <span title={contab.motivo || ''}>
                          <Chip
                            tono={
                              contab.clase.includes('faltante')
                                ? 'error'
                                : contab.clase.includes('cuadra')
                                  ? 'exito'
                                  : 'neutro'
                            }
                          >
                            {contab.etiqueta}
                          </Chip>
                        </span>
                        {contab.puedeReenviar && (
                          <div className="adm-reenviar">
                            <Boton variante="fantasma" onClick={() => reenviar(d.id)} disabled={reenviandoId === d.id}>
                              {reenviandoId === d.id ? 'Reenviando...' : 'Reenviar'}
                            </Boton>
                            {errorReenviar?.id === d.id && (
                              <span className="adm-detalle adm-accion--peligro">{errorReenviar.mensaje}</span>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {d.estado === 'PENDIENTE' && (
                      <div className="adm-acciones">
                        <Boton variante="contorno" onClick={() => abrirResolver(d)}>
                          Resolver
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

      {seleccionada && (
        <Modal abierto titulo="Resolver diferencia" onCerrar={resolviendo ? undefined : cerrarResolver}>
          <form className="adm-form" onSubmit={confirmarResolver}>
            <p>
              Turno {seleccionada.turno_id} · {seleccionada.caja_id} ·{' '}
              <strong className={`adm-diferencia--${seleccionada.tipo?.toLowerCase()}`}>
                {ETIQUETA_TIPO[seleccionada.tipo] ?? seleccionada.tipo}: Bs. {Math.abs(seleccionada.monto).toFixed(2)}
              </strong>
            </p>

            <AreaTexto
              etiqueta="Justificación"
              rows={4}
              value={justificacion}
              onChange={(e) => {
                setJustificacion(e.target.value)
                setErrorResolver(null)
              }}
              autoFocus
            />

            {errorResolver && <Alerta tono="error" titulo={errorResolver} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={cerrarResolver} disabled={resolviendo}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={resolviendo}>
                {resolviendo ? 'Resolviendo...' : 'Resolver'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default DiferenciasCaja
