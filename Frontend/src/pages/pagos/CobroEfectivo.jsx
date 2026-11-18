import DesgloseVuelto from '../../components/DesgloseVuelto.jsx'
import { Alerta, CampoTexto } from '../../components/ui'

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
    <div className="cob-bloque">
      <CampoTexto
        etiqueta="Monto recibido"
        prefijo="Bs"
        type="number"
        step="0.01"
        value={montoRecibido}
        onChange={(e) => onCambiarMontoRecibido(e.target.value)}
      />

      <div className="cob-fichas">
        {BILLETES_RAPIDOS.map((valor) => (
          <button key={valor} type="button" className="cob-ficha" onClick={() => onAgregarBillete(valor)}>
            +{valor}
          </button>
        ))}
        {montoRecibido && (
          <button type="button" className="cob-ficha cob-ficha--limpiar" onClick={() => onCambiarMontoRecibido('')}>
            Limpiar
          </button>
        )}
      </div>

      {calculandoVuelto && <p className="cob-nota">Calculando vuelto...</p>}
      {/* TDSI-573: si ya se muestra la validacion del formulario, no repetir el aviso */}
      {errorVuelto && !errorValidacion && <Alerta tono="error" titulo={errorVuelto} />}
      {vuelto !== null && !calculandoVuelto && <DesgloseVuelto vuelto={vuelto} desglose={desgloseVuelto} />}
    </div>
  )
}

export default CobroEfectivo
