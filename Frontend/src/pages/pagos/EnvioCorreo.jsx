// Pregunta si se envía la factura por correo y pide el correo del cliente.
function EnvioCorreo({ enviarCorreo, email, onCambiarCampo }) {
  return (
    <div className="factura-correo">
      <p>¿Desea enviar la factura al cliente por correo?</p>
      <div className="factura-correo-acciones">
        <button
          type="button"
          className={`btn${enviarCorreo === false ? '' : ' btn-secundario'}`}
          onClick={() => onCambiarCampo('enviarCorreo', false)}
        >
          No
        </button>
        <button
          type="button"
          className={`btn${enviarCorreo === true ? '' : ' btn-secundario'}`}
          onClick={() => onCambiarCampo('enviarCorreo', true)}
        >
          Sí
        </button>
      </div>

      {enviarCorreo === true && (
        <label className="campo" style={{ marginTop: '1rem' }}>
          Correo del cliente
          <input type="email" value={email} onChange={(e) => onCambiarCampo('email', e.target.value)} />
        </label>
      )}
    </div>
  )
}

export default EnvioCorreo
