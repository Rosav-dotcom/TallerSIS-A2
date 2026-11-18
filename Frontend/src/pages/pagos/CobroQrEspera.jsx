import { urlQrCuenta } from '../../api/cobros.js'
import { Alerta, Boton, Chip, Tarjeta } from '../../components/ui'
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
    <Tarjeta titulo="Cobro con QR" acciones={<Chip>{cobroQr.estado}</Chip>} className="cob-paso">
      <div className="cob-bloque">
        <div>
          <span className="cob-qr-monto">Bs. {cobroQr.monto}</span>
          <p className="cob-nota">Referencia: {cobroQr.referencia}</p>
        </div>
        <img src={urlQrCuenta()} alt="QR de la cuenta del negocio" className="cob-qr-imagen" />

        {cobroQr.estado === 'Pendiente' && (
          <>
            <p className="cob-qr-estado">Esperando pago...</p>
            {segundosRestantes != null && (
              <p className="cob-nota cob-centro">
                {segundosRestantes > 0
                  ? `El QR expira en ${formatearTiempoRestante(segundosRestantes)}`
                  : 'Verificando vencimiento...'}
              </p>
            )}
            {errorApi && <Alerta tono="error" titulo={errorApi} />}
            <div className="cob-acciones">
              <Boton variante="contorno" onClick={onCancelar} disabled={enviando}>
                Cancelar
              </Boton>
              <Boton onClick={onConfirmarPagoRecibido} disabled={enviando || segundosRestantes === 0}>
                {enviando ? 'Confirmando...' : 'Confirmar pago recibido'}
              </Boton>
            </div>
          </>
        )}

        {cobroQr.estado === 'Pagado' && (
          <>
            <p className="cob-qr-estado">Pago confirmado. Terminando de registrar la venta...</p>
            {errorApi && (
              <>
                <Alerta tono="error" titulo={errorApi} />
                <div className="cob-acciones">
                  <Boton onClick={onReintentarRegistro} disabled={enviando}>
                    {enviando ? 'Reintentando...' : 'Reintentar registrar venta'}
                  </Boton>
                </div>
              </>
            )}
          </>
        )}

        {cobroQr.estado === 'Expirado' && (
          <>
            <Alerta
              tono="advertencia"
              titulo="El QR expiró (pasaron más de 5 minutos). Genere uno nuevo para cobrar."
            />
            {errorApi && <Alerta tono="error" titulo={errorApi} />}
            <div className="cob-acciones">
              <Boton variante="contorno" onClick={onCancelar} disabled={enviando}>
                Cancelar
              </Boton>
              <Boton onClick={onRegenerarQr} disabled={enviando}>
                {enviando ? 'Generando...' : 'Regenerar QR'}
              </Boton>
            </div>
          </>
        )}
      </div>
    </Tarjeta>
  )
}

export default CobroQrEspera
