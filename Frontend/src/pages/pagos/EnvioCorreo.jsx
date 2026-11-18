import { CampoTexto } from '../../components/ui'

// Pregunta si se envía la factura por correo y pide el correo del cliente.
function EnvioCorreo({ enviarCorreo, email, onCambiarCampo }) {
  return (
    <div className="cob-bloque">
      <div>
        <p className="cob-pregunta">¿Desea enviar la factura al cliente por correo?</p>
        <div className="cob-segmento">
          <button
            type="button"
            className={`cob-segmento-opcion${enviarCorreo === false ? ' cob-segmento-opcion--activa' : ''}`}
            aria-pressed={enviarCorreo === false}
            onClick={() => onCambiarCampo('enviarCorreo', false)}
          >
            No
          </button>
          <button
            type="button"
            className={`cob-segmento-opcion${enviarCorreo === true ? ' cob-segmento-opcion--activa' : ''}`}
            aria-pressed={enviarCorreo === true}
            onClick={() => onCambiarCampo('enviarCorreo', true)}
          >
            Sí
          </button>
        </div>
      </div>

      {enviarCorreo === true && (
        <CampoTexto
          etiqueta="Correo del cliente"
          type="email"
          value={email}
          onChange={(e) => onCambiarCampo('email', e.target.value)}
        />
      )}
    </div>
  )
}

export default EnvioCorreo
