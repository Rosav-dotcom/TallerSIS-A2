import { Check } from 'lucide-react'
import { urlFacturaPdf } from '../../api/pagos.js'
import { Alerta, Boton, Icono, Tarjeta } from '../../components/ui'

// Paso "Pago registrado": datos del cobro, envío por correo, factura y registrar otro pago.
function PagoRegistrado({ pagoRegistrado, enviarCorreo, enviandoFactura, envioFactura, onRegistrarOtro }) {
  return (
    <Tarjeta
      titulo={
        <span className="cob-titulo-exito">
          <Icono icono={Check} tamano={24} />
          Pago registrado
        </span>
      }
      className="cob-paso"
    >
      <div className="cob-bloque">
        <p className="cob-nota">
          ID de transacción: {pagoRegistrado.id_transaccion} · {new Date(pagoRegistrado.fecha).toLocaleString()}
        </p>
        <ul className="cob-datos">
          {pagoRegistrado.detalle ? (
            pagoRegistrado.detalle.map((d) => (
              <li key={d.orden}>
                <span>{d.metodo}</span>
                <span>Bs. {d.monto}</span>
              </li>
            ))
          ) : (
            <li>
              <span>Método de pago</span>
              <span>{pagoRegistrado.metodo}</span>
            </li>
          )}
          {pagoRegistrado.leyendaUsd && (
            <li>
              <span>{pagoRegistrado.leyendaUsd}</span>
            </li>
          )}
          {pagoRegistrado.monto_recibido != null && (
            <>
              <li>
                <span>Monto recibido</span>
                <span>Bs. {pagoRegistrado.monto_recibido}</span>
              </li>
              <li>
                <span>Vuelto entregado</span>
                <span>Bs. {pagoRegistrado.vuelto}</span>
              </li>
            </>
          )}
          <li>
            <span>Estado</span>
            <span>{pagoRegistrado.estado}</span>
          </li>
        </ul>

        <div className="cob-total">
          <span className="cob-total-etiqueta">Total pagado</span>
          <span className="cob-total-monto">Bs. {pagoRegistrado.monto}</span>
        </div>

        {enviarCorreo && (enviandoFactura || envioFactura?.mensaje) && (
          <Alerta
            tono={enviandoFactura ? 'info' : envioFactura?.ok ? 'exito' : 'error'}
            titulo={enviandoFactura ? 'Enviando factura por correo...' : envioFactura?.mensaje}
          />
        )}

        <div className="cob-acciones cob-acciones--columna">
          {/* TDSI-303: factura real en PDF (formato tirilla), lista para ver o imprimir */}
          <a
            href={urlFacturaPdf(pagoRegistrado.id_transaccion)}
            target="_blank"
            rel="noopener noreferrer"
            className="ui-boton ui-boton--primario"
          >
            Ver / Imprimir factura
          </a>
          <Boton variante="contorno" onClick={onRegistrarOtro}>
            Registrar otro pago
          </Boton>
        </div>
      </div>
    </Tarjeta>
  )
}

export default PagoRegistrado
