import { Send } from 'lucide-react'
import { Alerta, Aviso, Boton, Chip, Tarjeta } from '../../components/ui'
import { fechaHora } from './formato.js'

const TONO = { Enviado: 'exito', Error: 'error', Pendiente: 'advertencia' }

// TDSI-1084: estado del correo con el comprobante (chip Enviado o Error) y el botón "Reenviar".
// Si el envío falló, se ve el motivo (PA "Si el envío falla se tiene que ver el error").
function CorreoCliente({ envio, reenviando, resultado, errorReenvio, onReenviar, onCerrarResultado }) {
  return (
    <Tarjeta titulo="Correo del cliente" acciones={<Chip tono={TONO[envio.estado]}>{envio.estado}</Chip>}>
      <div className="pag-vista">
        {envio.estado === 'Error' && (
          <Aviso tono="error" titulo="No se pudo emitir">
            {envio.ultimo_error || 'El correo con el comprobante no llegó a enviarse.'}
          </Aviso>
        )}
        <dl className="pag-datos">
          <div className="pag-dato">
            <dt>Correo</dt>
            <dd>{envio.email}</dd>
          </div>
          <div className="pag-dato">
            <dt>{envio.estado === 'Enviado' ? 'Enviado' : 'Último intento'}</dt>
            <dd>{fechaHora(envio.estado === 'Enviado' ? envio.enviado_en : envio.actualizado_en)}</dd>
          </div>
          <div className="pag-dato">
            <dt>Intentos</dt>
            <dd>{envio.intentos}</dd>
          </div>
        </dl>
        {envio.simulado && envio.estado === 'Enviado' && (
          <p className="pag-nota">Envío simulado: el servidor no tiene configurado el correo (SMTP).</p>
        )}
        {resultado && (
          <Aviso tono="exito" titulo="Comprobante reenviado" onCerrar={onCerrarResultado}>
            {resultado}
          </Aviso>
        )}
        {errorReenvio && <Alerta tono="error" titulo={`No se pudo reenviar: ${errorReenvio}`} />}
        <div className="pag-acciones">
          <Boton variante="secundario" icono={Send} disabled={!envio.puede_reenviar || reenviando} onClick={onReenviar}>
            {reenviando ? 'Reenviando…' : 'Reenviar'}
          </Boton>
        </div>
      </div>
    </Tarjeta>
  )
}

export default CorreoCliente
