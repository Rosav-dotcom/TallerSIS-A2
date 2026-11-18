import { Alerta, Boton, CampoTexto } from '../../components/ui'
import { totalEnDolares } from './utilidades.js'

// Pago en efectivo en dólares: tipo de cambio, dólares recibidos y vuelto en Bs.
function CobroUsd({
  errorTipoCambio,
  onReintentarTipoCambio,
  tipoCambioVigente,
  monto,
  dolaresRecibidos,
  onCambiarDolares,
  calculandoCobroUsd,
  errorCobroUsd,
  faltanteBs,
  cobroUsd,
}) {
  return (
    <div className="cob-bloque">
      {errorTipoCambio && (
        <>
          <Alerta tono="error" titulo={`No se pudo obtener el tipo de cambio: ${errorTipoCambio}`} />
          <div>
            <Boton variante="contorno" onClick={onReintentarTipoCambio}>
              Reintentar
            </Boton>
          </div>
        </>
      )}
      {tipoCambioVigente !== null && (
        <ul className="cob-datos">
          <li>
            <span>Tipo de cambio vigente</span>
            <strong>1 USD = Bs. {tipoCambioVigente.toFixed(2)}</strong>
          </li>
          {Number(monto) > 0 && (
            <li>
              <span>Total a cobrar</span>
              <strong>USD {totalEnDolares(Number(monto), tipoCambioVigente).toFixed(2)}</strong>
            </li>
          )}
        </ul>
      )}

      <CampoTexto
        etiqueta="Dólares recibidos"
        prefijo="USD"
        type="number"
        step="0.01"
        min="0"
        value={dolaresRecibidos}
        onChange={(e) => onCambiarDolares(e.target.value)}
      />

      {calculandoCobroUsd && <p className="cob-nota">Calculando vuelto...</p>}
      {errorCobroUsd && <Alerta tono="error" titulo={errorCobroUsd} />}
      {faltanteBs !== null && <Alerta tono="advertencia" titulo={`Faltan Bs. ${faltanteBs.toFixed(2)}`} />}
      {cobroUsd && (
        <div className="cob-vuelto">
          <ul className="cob-datos">
            <li>
              <span>Equivalente recibido</span>
              <strong>Bs. {cobroUsd.equivalenteBs.toFixed(2)}</strong>
            </li>
          </ul>
          <div className="cob-vuelto-cabecera">
            <span className="cob-vuelto-etiqueta">Vuelto a entregar</span>
            <span className="cob-vuelto-monto">Bs. {cobroUsd.vuelto.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CobroUsd
