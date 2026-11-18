import { useEffect, useState } from 'react'
import {
  listarRespuestasAnulacion,
  crearRespuestaAnulacion,
  editarRespuestaAnulacion,
  eliminarRespuestaAnulacion,
  validarMotivoAnulacion,
  MAXIMO_RESPUESTAS_ANULACION,
  LARGO_MAXIMO_ANULACION,
} from '../api/respuestasAnulacion.js'
import { Alerta, Boton, Modal } from './ui'

// Las clases respuestas-* son las del panel de TDSI-44 (mismo enfoque y mismo aspecto).

function CampoRespuesta({ id, valor, onCambiar, autoFocus }) {
  return (
    <>
      <span className="ui-control ui-control--area">
        <textarea
          id={id}
          rows={2}
          maxLength={LARGO_MAXIMO_ANULACION}
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => onCambiar(e.target.value)}
        />
      </span>
      <span className="fac-contador">
        {valor.trim().length}/{LARGO_MAXIMO_ANULACION}
      </span>
    </>
  )
}

// TDSI-174: panel "Mis respuestas de anulación" del cajero, con el formulario "Nueva respuesta"
// (TDSI-894), edición y "Eliminar" con confirmación (TDSI-895). Cada cajero ve solo las suyas.
function PanelRespuestasAnulacion({ cajeroId, onCerrar }) {
  const [respuestas, setRespuestas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [intento, setIntento] = useState(0)

  const [nuevoTexto, setNuevoTexto] = useState('')
  const [editando, setEditando] = useState(null) // { id, texto }
  const [porEliminar, setPorEliminar] = useState(null) // id
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setErrorCarga(null)
    listarRespuestasAnulacion(cajeroId)
      .then((r) => {
        if (!cancelado) setRespuestas(r.data)
      })
      .catch((err) => {
        if (!cancelado) setErrorCarga(err.message)
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [cajeroId, intento])

  const llegoAlMaximo = respuestas.length >= MAXIMO_RESPUESTAS_ANULACION

  function avisar(texto) {
    setError(null)
    setMensaje(texto)
  }

  function fallar(texto) {
    setMensaje(null)
    setError(texto)
  }

  async function guardarNueva(event) {
    event.preventDefault()
    const errorTexto = validarMotivoAnulacion(nuevoTexto)
    if (errorTexto) return fallar(errorTexto)
    if (llegoAlMaximo) return

    setEnviando(true)
    setError(null)
    try {
      // El backend guarda "orden" pero no lo calcula: se deja al final de la lista.
      const orden = Math.max(0, ...respuestas.map((r) => r.orden)) + 1
      const { data } = await crearRespuestaAnulacion({ cajero_id: cajeroId, texto: nuevoTexto.trim(), orden })
      setRespuestas((prev) => [...prev, data])
      setNuevoTexto('')
      avisar('Respuesta guardada.')
    } catch (err) {
      fallar(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function guardarEdicion(event) {
    event.preventDefault()
    const errorTexto = validarMotivoAnulacion(editando.texto)
    if (errorTexto) return fallar(errorTexto)

    setEnviando(true)
    setError(null)
    try {
      const { data } = await editarRespuestaAnulacion(editando.id, { cajero_id: cajeroId, texto: editando.texto.trim() })
      setRespuestas((prev) => prev.map((r) => (r.id === data.id ? data : r)))
      setEditando(null)
      avisar('Respuesta actualizada.')
    } catch (err) {
      fallar(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarEliminar(id) {
    setEnviando(true)
    setError(null)
    try {
      await eliminarRespuestaAnulacion(id, cajeroId)
      setRespuestas((prev) => prev.filter((r) => r.id !== id))
      setPorEliminar(null)
      avisar('Respuesta eliminada.')
    } catch (err) {
      fallar(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo="Mis respuestas de anulación" onCerrar={onCerrar}>
      <p className="fac-nota">
        Motivos para elegir con un clic al anular una factura. Si editas o eliminas uno, las facturas ya anuladas
        conservan el motivo que tenían.
      </p>

      {cargando && <p className="fac-nota">Cargando...</p>}

      {!cargando && errorCarga && (
        <div className="fac-form">
          <Alerta tono="error" titulo={`No se pudieron cargar tus respuestas: ${errorCarga}`} />
          <Boton variante="contorno" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </Boton>
        </div>
      )}

      {!cargando && !errorCarga && (
        <>
          {respuestas.length === 0 ? (
            <p className="fac-nota">Todavía no tienes respuestas de anulación.</p>
          ) : (
            <ul className="fac-panel-lista">
              {respuestas.map((r) => (
                <li key={r.id} className="fac-panel-item">
                  {editando?.id === r.id ? (
                    <form onSubmit={guardarEdicion} className="fac-form">
                      <label htmlFor={`editar-anulacion-${r.id}`} className="ui-campo-etiqueta">
                        Editar respuesta
                      </label>
                      <CampoRespuesta
                        id={`editar-anulacion-${r.id}`}
                        valor={editando.texto}
                        onCambiar={(texto) => setEditando({ id: r.id, texto })}
                        autoFocus
                      />
                      <div className="fac-panel-acciones">
                        <Boton type="submit" disabled={enviando}>
                          Guardar
                        </Boton>
                        <Boton variante="contorno" onClick={() => setEditando(null)} disabled={enviando}>
                          Cancelar
                        </Boton>
                      </div>
                    </form>
                  ) : porEliminar === r.id ? (
                    <div className="fac-panel-confirmar">
                      <p>¿Eliminar «{r.texto}»?</p>
                      <div className="fac-panel-acciones">
                        <Boton variante="peligro" onClick={() => confirmarEliminar(r.id)} disabled={enviando}>
                          Sí, eliminar
                        </Boton>
                        <Boton variante="contorno" onClick={() => setPorEliminar(null)} disabled={enviando} autoFocus>
                          No
                        </Boton>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span>{r.texto}</span>
                      <div className="fac-panel-acciones">
                        <Boton
                          variante="fantasma"
                          onClick={() => {
                            setPorEliminar(null)
                            setError(null)
                            setEditando({ id: r.id, texto: r.texto })
                          }}
                        >
                          Editar
                        </Boton>
                        <Boton
                          variante="fantasma"
                          className="fac-accion--peligro"
                          onClick={() => {
                            setEditando(null)
                            setPorEliminar(r.id)
                          }}
                        >
                          Eliminar
                        </Boton>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="fac-nota">
            {respuestas.length} de {MAXIMO_RESPUESTAS_ANULACION} respuestas
          </p>

          {llegoAlMaximo ? (
            <Alerta
              tono="info"
              titulo={`Llegaste al máximo de ${MAXIMO_RESPUESTAS_ANULACION}. Elimina una para agregar otra.`}
            />
          ) : (
            <form onSubmit={guardarNueva} className="fac-form">
              <label htmlFor="nueva-respuesta-anulacion" className="ui-campo-etiqueta">
                Nueva respuesta
              </label>
              <CampoRespuesta id="nueva-respuesta-anulacion" valor={nuevoTexto} onCambiar={setNuevoTexto} />
              <div className="fac-panel-acciones">
                <Boton type="submit" disabled={enviando}>
                  Agregar
                </Boton>
              </div>
            </form>
          )}
        </>
      )}

      {error && <Alerta tono="error" titulo={error} />}
      {mensaje && <Alerta tono="exito" titulo={mensaje} />}
    </Modal>
  )
}

// Botón de la pantalla Facturas que abre el panel. Lleva su propio estado para que Facturas
// solo tenga que mostrarlo.
function MisRespuestasAnulacion({ cajeroId }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Boton variante="contorno" onClick={() => setAbierto(true)}>
        Mis respuestas de anulación
      </Boton>
      {abierto && <PanelRespuestasAnulacion cajeroId={cajeroId} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export default MisRespuestasAnulacion
