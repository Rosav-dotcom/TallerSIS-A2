import { urlQrCuenta } from '../../api/cobros.js'
import { formatearTiempoRestante } from './utilidades.js'

// Paso "Cobro con QR": QR, cuenta regresiva y estados Pendiente, Pagado y Expirado.
function CobroQrEspera({
  cobroQr,
  segundosRestantes,
  errorApi,
  enviando,
  onCancelar,
  onConfirmarPagoRecibido,
  onReintentarRegistro,
  onRegenerarQr,
}) {
  return (
    <div className="cobro-qr-espera">
      <h2>Cobro con QR</h2>
      <img src={urlQrCuenta()} alt="QR de la cuenta del negocio" className="cobro-qr-imagen" />
      <p className="cobro-qr-monto">Bs. {cobroQr.monto}</p>
      <p className="cobro-qr-referencia">Referencia: {cobroQr.referencia}</p>

      {cobroQr.estado === 'Pendiente' && (
        <>
          <p className="cobro-qr-estado cobro-qr-estado--pendiente">Esperando pago...</p>
          {segundosRestantes != null && (
            <p className="cobro-qr-cuenta-regresiva">
              {segundosRestantes > 0
                ? `El QR expira en ${formatearTiempoRestante(segundosRestantes)}`
                : 'Verificando vencimiento...'}
            </p>
          )}
          {errorApi && <p className="error">{errorApi}</p>}
          <div className="pago-acciones">
            <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              onClick={onConfirmarPagoRecibido}
              disabled={enviando || segundosRestantes === 0}
            >
              {enviando ? 'Confirmando...' : 'Confirmar pago recibido'}
            </button>
          </div>
        </>
      )}

      {cobroQr.estado === 'Pagado' && (
        <>
          <p className="cobro-qr-estado cobro-qr-estado--pendiente">
            Pago confirmado. Terminando de registrar la venta...
          </p>
          {errorApi && (
            <>
              <p className="error">{errorApi}</p>
              <div className="pago-acciones">
                <button type="button" className="btn" onClick={onReintentarRegistro} disabled={enviando}>
                  {enviando ? 'Reintentando...' : 'Reintentar registrar venta'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {cobroQr.estado === 'Expirado' && (
        <>
          <p className="cobro-qr-estado cobro-qr-estado--expirado">
            El QR expiró (pasaron más de 5 minutos). Genere uno nuevo para cobrar.
          </p>
          {errorApi && <p className="error">{errorApi}</p>}
          <div className="pago-acciones">
            <button type="button" className="btn btn-secundario" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className="btn" onClick={onRegenerarQr} disabled={enviando}>
              {enviando ? 'Generando...' : 'Regenerar QR'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default CobroQrEspera
