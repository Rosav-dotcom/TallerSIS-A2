import { useEffect, useState } from 'react'
import {
  listarRespuestasRapidas,
  crearRespuestaRapida,
  editarRespuestaRapida,
  eliminarRespuestaRapida,
  validarTextoRespuesta,
  MAXIMO_RESPUESTAS,
  LARGO_MAXIMO,
} from '../api/respuestasRapidas.js'
import { Alerta, Boton, Modal } from './ui'

// Campo de texto con contador de caracteres, para crear y para editar una respuesta.
function CampoRespuesta({ id, valor, onCambiar, autoFocus }) {
  return (
    <>
      <span className="ui-control ui-control--area">
        <textarea
          id={id}
          rows={2}
          maxLength={LARGO_MAXIMO}
          value={valor}
          autoFocus={autoFocus}
          onChange={(e) => onCambiar(e.target.value)}
        />
      </span>
      <span className="cob-contador">
        {valor.trim().length}/{LARGO_MAXIMO}
      </span>
    </>
  )
}

// TDSI-44: panel "Mis respuestas rápidas" del cajero.
// Formulario "Nueva respuesta", edición y "Eliminar" con confirmación.
// Cada cajero ve solo las suyas (se piden por su cajero_id), y siguen ahí en otros turnos.
function MisRespuestasRapidas({ cajeroId, onCerrar }) {
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
    listarRespuestasRapidas(cajeroId)
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

  const llegoAlMaximo = respuestas.length >= MAXIMO_RESPUESTAS

  function avisar(texto) {
    setError(null)
    setMensaje(texto)
  }

  async function guardarNueva(event) {
    event.preventDefault()
    const errorTexto = validarTextoRespuesta(nuevoTexto)
    if (errorTexto) {
      setMensaje(null)
      setError(errorTexto)
      return
    }
    if (llegoAlMaximo) return

    setEnviando(true)
    setError(null)
    try {
      // El backend guarda "orden" pero no lo calcula: se deja al final de la lista.
      const orden = Math.max(0, ...respuestas.map((r) => r.orden)) + 1
      const { data } = await crearRespuestaRapida({ cajero_id: cajeroId, texto: nuevoTexto.trim(), orden })
      setRespuestas((prev) => [...prev, data])
      setNuevoTexto('')
      avisar('Respuesta guardada.')
    } catch (err) {
      setMensaje(null)
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function guardarEdicion(event) {
    event.preventDefault()
    const errorTexto = validarTextoRespuesta(editando.texto)
    if (errorTexto) {
      setMensaje(null)
      setError(errorTexto)
      return
    }

    setEnviando(true)
    setError(null)
    try {
      const { data } = await editarRespuestaRapida(editando.id, { cajero_id: cajeroId, texto: editando.texto.trim() })
      setRespuestas((prev) => prev.map((r) => (r.id === data.id ? data : r)))
      setEditando(null)
      avisar('Respuesta actualizada.')
    } catch (err) {
      setMensaje(null)
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function confirmarEliminar(id) {
    setEnviando(true)
    setError(null)
    try {
      await eliminarRespuestaRapida(id, cajeroId)
      setRespuestas((prev) => prev.filter((r) => r.id !== id))
      setPorEliminar(null)
      avisar('Respuesta eliminada.')
    } catch (err) {
      setMensaje(null)
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal abierto titulo="Mis respuestas rápidas" onCerrar={onCerrar}>
      <div className="cob-bloque">
        <p className="cob-nota">
          Frases para elegir con un clic al cancelar una venta. Si editas o eliminas una, las ventas ya canceladas
          conservan el texto que tenían.
        </p>

        {cargando && <p className="cob-nota">Cargando...</p>}

        {!cargando && errorCarga && (
          <div className="cob-bloque">
            <Alerta tono="error" titulo={`No se pudieron cargar tus respuestas: ${errorCarga}`} />
            <div>
              <Boton variante="contorno" onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </Boton>
            </div>
          </div>
        )}

        {!cargando && !errorCarga && (
          <>
            {respuestas.length === 0 ? (
              <p className="cob-nota">Todavía no tienes respuestas rápidas.</p>
            ) : (
              <ul className="cob-panel-lista">
                {respuestas.map((r) => (
                  <li key={r.id} className="cob-panel-item">
                    {editando?.id === r.id ? (
                      <form onSubmit={guardarEdicion} className="cob-bloque">
                        <label htmlFor={`editar-${r.id}`} className="ui-campo-etiqueta">
                          Editar respuesta
                        </label>
                        <CampoRespuesta
                          id={`editar-${r.id}`}
                          valor={editando.texto}
                          onCambiar={(texto) => setEditando({ id: r.id, texto })}
                          autoFocus
                        />
                        <div className="cob-panel-acciones">
                          <Boton type="submit" disabled={enviando}>
                            Guardar
                          </Boton>
                          <Boton variante="contorno" onClick={() => setEditando(null)} disabled={enviando}>
                            Cancelar
                          </Boton>
                        </div>
                      </form>
                    ) : porEliminar === r.id ? (
                      <div className="cob-panel-confirmar">
                        <p>¿Eliminar «{r.texto}»?</p>
                        <div className="cob-panel-acciones">
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
                        <div className="cob-panel-acciones">
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
                            className="cob-accion--peligro"
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

            <p className="cob-nota">
              {respuestas.length} de {MAXIMO_RESPUESTAS} respuestas
            </p>

            {llegoAlMaximo ? (
              <Alerta
                tono="info"
                titulo={`Llegaste al máximo de ${MAXIMO_RESPUESTAS}. Elimina una para agregar otra.`}
              />
            ) : (
              <form onSubmit={guardarNueva} className="cob-bloque">
                <label htmlFor="nueva-respuesta" className="ui-campo-etiqueta">
                  Nueva respuesta
                </label>
                <CampoRespuesta id="nueva-respuesta" valor={nuevoTexto} onCambiar={setNuevoTexto} />
                <div className="cob-panel-acciones">
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
      </div>
    </Modal>
  )
}

export default MisRespuestasRapidas
