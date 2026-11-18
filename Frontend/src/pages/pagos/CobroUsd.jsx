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
    <div className="cobro-efectivo">
      {errorTipoCambio && (
        <p className="error">
          No se pudo obtener el tipo de cambio: {errorTipoCambio}{' '}
          <button type="button" className="billete-rapido" onClick={onReintentarTipoCambio}>
            Reintentar
          </button>
        </p>
      )}
      {tipoCambioVigente !== null && (
        <ul className="cobro-usd-datos">
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

      <label className="campo">
        Dólares recibidos (USD)
        <input
          type="number"
          step="0.01"
          min="0"
          value={dolaresRecibidos}
          onChange={(e) => onCambiarDolares(e.target.value)}
        />
      </label>

      {calculandoCobroUsd && <p className="ayuda-mixto">Calculando vuelto...</p>}
      {errorCobroUsd && <p className="error">{errorCobroUsd}</p>}
      {faltanteBs !== null && <p className="cobro-usd-faltante">Faltan Bs. {faltanteBs.toFixed(2)}</p>}
      {cobroUsd && (
        <>
          <ul className="cobro-usd-datos">
            <li>
              <span>Equivalente recibido</span>
              <strong>Bs. {cobroUsd.equivalenteBs.toFixed(2)}</strong>
            </li>
          </ul>
          <p className="vuelto-destacado">Vuelto a entregar: Bs. {cobroUsd.vuelto.toFixed(2)}</p>
        </>
      )}
    </div>
  )
}

export default CobroUsd
