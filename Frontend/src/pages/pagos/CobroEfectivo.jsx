import DesgloseVuelto from '../../components/DesgloseVuelto.jsx'

// TDSI-29/572: botones rápidos de billetes para armar el monto recibido en efectivo.
const BILLETES_RAPIDOS = [10, 20, 50, 100, 200]

// Pago simple en efectivo: monto recibido, billetes rápidos y vuelto.
function CobroEfectivo({
  montoRecibido,
  onCambiarMontoRecibido,
  onAgregarBillete,
  calculandoVuelto,
  errorVuelto,
  errorValidacion,
  vuelto,
  desgloseVuelto,
}) {
  return (
    <div className="cobro-efectivo">
      <label className="campo">
        Monto recibido (Bs.)
        <input
          type="number"
          step="0.01"
          value={montoRecibido}
          onChange={(e) => onCambiarMontoRecibido(e.target.value)}
        />
      </label>

      <div className="billetes-rapidos">
        {BILLETES_RAPIDOS.map((valor) => (
          <button key={valor} type="button" className="billete-rapido" onClick={() => onAgregarBillete(valor)}>
            +{valor}
          </button>
        ))}
        {montoRecibido && (
          <button
            type="button"
            className="billete-rapido billete-rapido--limpiar"
            onClick={() => onCambiarMontoRecibido('')}
          >
            Limpiar
          </button>
        )}
      </div>

      {calculandoVuelto && <p className="ayuda-mixto">Calculando vuelto...</p>}
      {/* TDSI-573: si ya se muestra la validacion del formulario, no repetir el aviso */}
      {errorVuelto && !errorValidacion && <p className="error">{errorVuelto}</p>}
      {vuelto !== null && !calculandoVuelto && <DesgloseVuelto vuelto={vuelto} desglose={desgloseVuelto} />}
    </div>
  )
}

export default CobroEfectivo
