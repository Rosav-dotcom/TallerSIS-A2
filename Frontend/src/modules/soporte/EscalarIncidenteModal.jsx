import { useState } from 'react'
import { Alerta, AreaTexto, Boton, Modal } from '../../components/ui'
import { mensajeDeError } from './consultas.js'

// Límites del backend (TDSI-207).
export const MOTIVO_MIN = 10
export const MOTIVO_MAX = 500
const ID_FORMULARIO = 'sop-escalar'

function validar(motivo) {
  const limpio = motivo.trim()
  if (!limpio) return 'Escribe el motivo del escalamiento.'
  if (limpio.length < MOTIVO_MIN) return `El motivo debe tener al menos ${MOTIVO_MIN} caracteres.`
  return null
}

// TDSI-208: modal "Escalar a administrador". Sin motivo no se puede escalar (PA TDSI-981).
// onEscalar(motivo) devuelve una promesa: si falla, el error se muestra aquí y el modal sigue abierto.
function EscalarIncidenteModal({ numero, onCerrar, onEscalar }) {
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function escalar(event) {
    event.preventDefault()
    if (enviando) return
    const problema = validar(motivo)
    setErrorMotivo(problema)
    if (problema) return
    setEnviando(true)
    setError(null)
    try {
      await onEscalar(motivo.trim())
    } catch (err) {
      setError(mensajeDeError(err))
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto
      titulo="Escalar a administrador"
      onCerrar={enviando ? () => {} : onCerrar}
      acciones={
        <>
          <Boton variante="contorno" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={ID_FORMULARIO} disabled={enviando}>
            {enviando ? 'Escalando…' : 'Escalar'}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="sop-formulario" onSubmit={escalar} noValidate>
        <p className="sop-nota">
          El incidente {numero} pasará a Escalado y el administrador lo verá en su bandeja de incidentes escalados.
        </p>
        <AreaTexto
          etiqueta="Motivo"
          rows={5}
          maxLength={MOTIVO_MAX}
          placeholder="¿Por qué no se puede resolver desde Soporte?"
          value={motivo}
          error={errorMotivo}
          onChange={(e) => {
            setMotivo(e.target.value)
            setErrorMotivo(null)
          }}
        />
        {error && <Alerta tono="error" titulo={`No se pudo escalar el incidente: ${error}`} />}
      </form>
    </Modal>
  )
}

export default EscalarIncidenteModal
