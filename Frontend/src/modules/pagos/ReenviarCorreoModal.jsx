import { useState } from 'react'
import { Alerta, Boton, CampoTexto, Modal } from '../../components/ui'

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const ID_FORMULARIO = 'pag-reenviar'

// TDSI-1123: antes de reenviar, el correo del cliente se puede corregir. Llega precargado; si no
// cambia, se reenvía al mismo. onReenviar(email | undefined) devuelve una promesa: si falla, el
// error se ve aquí y el modal sigue abierto.
function ReenviarCorreoModal({ emailActual, onCerrar, onReenviar }) {
  const [email, setEmail] = useState(emailActual)
  const [errorEmail, setErrorEmail] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function reenviar(event) {
    event.preventDefault()
    if (enviando) return
    const limpio = email.trim().toLowerCase()
    if (!FORMATO_CORREO.test(limpio)) {
      setErrorEmail('Ingresa un correo válido, por ejemplo cliente@correo.com.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await onReenviar(limpio === emailActual ? undefined : limpio)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal
      abierto
      titulo="Reenviar comprobante"
      onCerrar={enviando ? () => {} : onCerrar}
      acciones={
        <>
          <Boton variante="contorno" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={ID_FORMULARIO} variante="secundario" disabled={enviando}>
            {enviando ? 'Reenviando…' : 'Reenviar'}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="pag-vista" onSubmit={reenviar} noValidate>
        <CampoTexto
          etiqueta="Correo del cliente"
          type="email"
          autoComplete="off"
          ayuda="Corrígelo si el cliente dio otro correo o estaba mal escrito."
          value={email}
          error={errorEmail}
          onChange={(e) => {
            setEmail(e.target.value)
            setErrorEmail(null)
          }}
        />
        {error && <Alerta tono="error" titulo={`No se pudo reenviar: ${error}`} />}
      </form>
    </Modal>
  )
}

export default ReenviarCorreoModal
