import { MENSAJE_FORMATO_DOCUMENTO, REGEX_DOCUMENTO } from './constantes.js'

const TIPOS_DOCUMENTO = [
  { id: 'NINGUNO', etiqueta: 'Sin datos' },
  { id: 'NIT', etiqueta: 'NIT' },
  { id: 'CI', etiqueta: 'CI' },
]

const MAX_LARGO_DOCUMENTO = { NIT: 10, CI: 8 }

// Datos de facturación (Sin datos, NIT o CI), razón social y teléfono del cliente.
function DatosFacturacion({
  tipoDocumento,
  numeroDocumento,
  razonSocial,
  telefono,
  onElegirTipoDocumento,
  onCambiarCampo,
  onSalirDocumento,
}) {
  return (
    <>
      <fieldset style={{ border: 'none', padding: 0 }}>
        <legend>Datos de facturación</legend>
        <div className="tipo-venta-opciones">
          {TIPOS_DOCUMENTO.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              className={`tipo-venta-opcion${tipoDocumento === tipo.id ? ' activa' : ''}`}
              onClick={() => onElegirTipoDocumento(tipo.id)}
            >
              {tipo.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {tipoDocumento !== 'NINGUNO' && (
        <>
          <label className="campo">
            Número de {tipoDocumento}
            <input
              type="text"
              inputMode="numeric"
              maxLength={MAX_LARGO_DOCUMENTO[tipoDocumento]}
              value={numeroDocumento}
              onChange={(e) => onCambiarCampo('numeroDocumento', e.target.value.replace(/\D/g, ''))}
              onBlur={onSalirDocumento}
            />
          </label>
          {numeroDocumento && !REGEX_DOCUMENTO[tipoDocumento].test(numeroDocumento) && (
            <p className="error" style={{ marginTop: '-0.75rem' }}>
              {MENSAJE_FORMATO_DOCUMENTO[tipoDocumento]}
            </p>
          )}
          <label className="campo">
            Razón social
            <input type="text" value={razonSocial} onChange={(e) => onCambiarCampo('razonSocial', e.target.value)} />
          </label>
        </>
      )}

      <label className="campo">
        Teléfono del cliente (opcional)
        <input type="tel" value={telefono} onChange={(e) => onCambiarCampo('telefono', e.target.value)} />
      </label>
    </>
  )
}

export default DatosFacturacion
