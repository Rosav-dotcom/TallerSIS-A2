import DesgloseVuelto from '../../components/DesgloseVuelto.jsx'

// Paso "Confirmar cobro": resumen de la venta antes de cobrar.
function ResumenCobro({
  datos,
  esMixto,
  esEfectivoUsd,
  cobroUsd,
  esEfectivoSimple,
  esMixtoConEfectivo,
  vuelto,
  calculandoVuelto,
  desgloseVuelto,
  errorApi,
  enviando,
  esQrSimple,
  onEditar,
  onConfirmar,
  onCancelarVenta,
}) {
  return (
    <div className="pago-resumen">
      <h2>Confirmar cobro</h2>
      <ul>
        <li>Monto: Bs. {datos.monto}</li>
        {esMixto ? (
          <li>
            Métodos de pago: {datos.metodos[0]} (Bs. {datos.montoMixto1}) + {datos.metodos[1]} (Bs. {datos.montoMixto2})
          </li>
        ) : (
          <li>Método de pago: {esEfectivoUsd ? 'Efectivo en dólares' : datos.metodos[0]}</li>
        )}
        {esEfectivoUsd && cobroUsd && (
          <>
            <li>Dólares recibidos: USD {cobroUsd.dolaresRecibidos.toFixed(2)}</li>
            <li>Tipo de cambio: 1 USD = Bs. {cobroUsd.tipoCambio.toFixed(2)}</li>
            <li>Equivalente recibido: Bs. {cobroUsd.equivalenteBs.toFixed(2)}</li>
            <li>Vuelto a entregar: Bs. {cobroUsd.vuelto.toFixed(2)}</li>
          </>
        )}
        {(esEfectivoSimple || (esMixtoConEfectivo && datos.montoRecibido)) && (
          <li>
            {esMixto ? 'Efectivo recibido' : 'Monto recibido'}: Bs. {datos.montoRecibido}
          </li>
        )}
        <li>
          Datos de facturación:{' '}
          {datos.tipoDocumento === 'NINGUNO'
            ? 'Sin datos'
            : `${datos.tipoDocumento} ${datos.numeroDocumento} — ${datos.razonSocial}`}
        </li>
        {datos.telefono && <li>Teléfono: {datos.telefono}</li>}
        <li>Envío por correo: {datos.enviarCorreo ? `Sí, a ${datos.email}` : 'No'}</li>
      </ul>
      {vuelto !== null && !calculandoVuelto && <DesgloseVuelto vuelto={vuelto} desglose={desgloseVuelto} />}

      {errorApi && <p className="error">Error: {errorApi}</p>}

      <div className="pago-acciones">
        <button type="button" className="btn btn-secundario" onClick={onEditar} disabled={enviando}>
          Editar
        </button>
        <button type="button" className="btn" onClick={onConfirmar} disabled={enviando}>
          {enviando
            ? esQrSimple
              ? 'Generando QR...'
              : 'Confirmando...'
            : esQrSimple
              ? 'Generar QR'
              : 'Confirmar cobro'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={onCancelarVenta} disabled={enviando}>
          Cancelar venta
        </button>
      </div>
    </div>
  )
}

export default ResumenCobro
