import { useState } from 'react'
import { AreaTexto, Boton, Tarjeta } from '../../components/ui'
import { fecha, texto } from './formato.js'

const LARGO_MAXIMO = 300
const TERMINADO = ['Resuelto', 'Cerrado']

// TDSI-206: solución aplicada. Sin solución no se puede marcar como Resuelto.
function SolucionIncidente({ ticket, guardando, onResolver }) {
  const [solucion, setSolucion] = useState('')

  async function enviar(event) {
    event.preventDefault()
    const limpia = solucion.trim()
    if (limpia && (await onResolver(limpia))) setSolucion('')
  }

  return (
    <Tarjeta titulo="Solución aplicada">
      <div className="sop-vista">
        {ticket.solucion && (
          <div>
            <p className="sop-texto">{ticket.solucion}</p>
            <p className="sop-nota">
              Registrada por {texto(ticket.solucion_registrada_por)} · {fecha(ticket.resuelto_en)}
            </p>
          </div>
        )}
        {!TERMINADO.includes(ticket.estado) && (
          <form className="sop-formulario" onSubmit={enviar}>
            <AreaTexto
              etiqueta={ticket.solucion ? 'Nueva solución' : 'Solución'}
              maxLength={LARGO_MAXIMO}
              value={solucion}
              disabled={guardando}
              onChange={(e) => setSolucion(e.target.value)}
            />
            <div className="sop-acciones">
              <Boton type="submit" disabled={guardando || !solucion.trim()}>
                Marcar como resuelto
              </Boton>
            </div>
          </form>
        )}
        {TERMINADO.includes(ticket.estado) && !ticket.solucion && (
          <p className="sop-nota">El incidente no tiene una solución registrada.</p>
        )}
      </div>
    </Tarjeta>
  )
}

export default SolucionIncidente
