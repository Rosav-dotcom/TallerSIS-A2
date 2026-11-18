import { urlFacturaPdf } from '../../api/pagos.js'

// Paso "Pago registrado": datos del cobro, envío por correo, factura y registrar otro pago.
function PagoRegistrado({ pagoRegistrado, enviarCorreo, enviandoFactura, envioFactura, onRegistrarOtro }) {
  return (
    <div className="pago-exito">
      <h2>Pago registrado</h2>
      <ul>
        <li>ID de transacción: {pagoRegistrado.id_transaccion}</li>
        {pagoRegistrado.detalle ? (
          pagoRegistrado.detalle.map((d) => (
            <li key={d.orden}>
              {d.metodo}: Bs. {d.monto}
            </li>
          ))
        ) : (
          <li>Método de pago: {pagoRegistrado.metodo}</li>
        )}
        {pagoRegistrado.leyendaUsd && <li className="leyenda-usd">{pagoRegistrado.leyendaUsd}</li>}
        <li>Monto: Bs. {pagoRegistrado.monto}</li>
        {pagoRegistrado.monto_recibido != null && (
          <>
            <li>Monto recibido: Bs. {pagoRegistrado.monto_recibido}</li>
            <li>Vuelto entregado: Bs. {pagoRegistrado.vuelto}</li>
          </>
        )}
        <li>Estado: {pagoRegistrado.estado}</li>
        <li>Fecha: {new Date(pagoRegistrado.fecha).toLocaleString()}</li>
      </ul>

      {enviarCorreo && (
        <p className={enviandoFactura ? '' : envioFactura?.ok ? 'mensaje-exito' : 'error'}>
          {enviandoFactura ? 'Enviando factura por correo...' : envioFactura?.mensaje}
        </p>
      )}

      <div className="pago-exito-acciones">
        {/* TDSI-303: factura real en PDF (formato tirilla), lista para ver o imprimir */}
        <a
          href={urlFacturaPdf(pagoRegistrado.id_transaccion)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-azul"
          style={{ display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
        >
          Ver / Imprimir factura
        </a>

        <button type="button" className="btn" onClick={onRegistrarOtro}>
          Registrar otro pago
        </button>
      </div>
    </div>
  )
}

export default PagoRegistrado
