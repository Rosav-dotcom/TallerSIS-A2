import { CampoTexto } from '../../components/ui'
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
      <fieldset className="cob-grupo">
        <legend>Datos de facturación</legend>
        <div className="cob-segmento">
          {TIPOS_DOCUMENTO.map((tipo) => (
            <button
              key={tipo.id}
              type="button"
              className={`cob-segmento-opcion${tipoDocumento === tipo.id ? ' cob-segmento-opcion--activa' : ''}`}
              aria-pressed={tipoDocumento === tipo.id}
              onClick={() => onElegirTipoDocumento(tipo.id)}
            >
              {tipo.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      {tipoDocumento !== 'NINGUNO' && (
        <>
          <CampoTexto
            etiqueta={`Número de ${tipoDocumento}`}
            type="text"
            inputMode="numeric"
            maxLength={MAX_LARGO_DOCUMENTO[tipoDocumento]}
            value={numeroDocumento}
            onChange={(e) => onCambiarCampo('numeroDocumento', e.target.value.replace(/\D/g, ''))}
            onBlur={onSalirDocumento}
            error={
              numeroDocumento && !REGEX_DOCUMENTO[tipoDocumento].test(numeroDocumento)
                ? MENSAJE_FORMATO_DOCUMENTO[tipoDocumento]
                : undefined
            }
          />
          <CampoTexto
            etiqueta="Razón social"
            type="text"
            value={razonSocial}
            onChange={(e) => onCambiarCampo('razonSocial', e.target.value)}
          />
        </>
      )}

      <CampoTexto
        etiqueta="Teléfono del cliente (opcional)"
        type="tel"
        value={telefono}
        onChange={(e) => onCambiarCampo('telefono', e.target.value)}
      />
    </>
  )
}

export default DatosFacturacion
