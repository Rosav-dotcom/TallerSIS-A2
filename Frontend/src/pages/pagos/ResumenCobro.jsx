import DesgloseVuelto from '../../components/DesgloseVuelto.jsx'
import { Alerta, Boton, Tarjeta } from '../../components/ui'

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
    <Tarjeta titulo="Confirmar cobro" className="cob-paso">
      <div className="cob-bloque">
        <ul className="cob-datos">
          {esMixto ? (
            <li>
              <span>Métodos de pago</span>
              <span>
                {datos.metodos[0]} (Bs. {datos.montoMixto1}) + {datos.metodos[1]} (Bs. {datos.montoMixto2})
              </span>
            </li>
          ) : (
            <li>
              <span>Método de pago</span>
              <span>{esEfectivoUsd ? 'Efectivo en dólares' : datos.metodos[0]}</span>
            </li>
          )}
          {esEfectivoUsd && cobroUsd && (
            <>
              <li>
                <span>Dólares recibidos</span>
                <span>USD {cobroUsd.dolaresRecibidos.toFixed(2)}</span>
              </li>
              <li>
                <span>Tipo de cambio</span>
                <span>1 USD = Bs. {cobroUsd.tipoCambio.toFixed(2)}</span>
              </li>
              <li>
                <span>Equivalente recibido</span>
                <span>Bs. {cobroUsd.equivalenteBs.toFixed(2)}</span>
              </li>
              <li>
                <span>Vuelto a entregar</span>
                <span>Bs. {cobroUsd.vuelto.toFixed(2)}</span>
              </li>
            </>
          )}
          {(esEfectivoSimple || (esMixtoConEfectivo && datos.montoRecibido)) && (
            <li>
              <span>{esMixto ? 'Efectivo recibido' : 'Monto recibido'}</span>
              <span>Bs. {datos.montoRecibido}</span>
            </li>
          )}
          <li>
            <span>Datos de facturación</span>
            <span>
              {datos.tipoDocumento === 'NINGUNO'
                ? 'Sin datos'
                : `${datos.tipoDocumento} ${datos.numeroDocumento} — ${datos.razonSocial}`}
            </span>
          </li>
          {datos.telefono && (
            <li>
              <span>Teléfono</span>
              <span>{datos.telefono}</span>
            </li>
          )}
          <li>
            <span>Envío por correo</span>
            <span>{datos.enviarCorreo ? `Sí, a ${datos.email}` : 'No'}</span>
          </li>
        </ul>

        <div className="cob-total">
          <span className="cob-total-etiqueta">Total a cobrar</span>
          <span className="cob-total-monto">Bs. {datos.monto}</span>
        </div>

        {vuelto !== null && !calculandoVuelto && <DesgloseVuelto vuelto={vuelto} desglose={desgloseVuelto} />}

        {errorApi && <Alerta tono="error" titulo={`Error: ${errorApi}`} />}

        <div className="cob-acciones">
          <Boton variante="fantasma" className="cob-accion--peligro" onClick={onCancelarVenta} disabled={enviando}>
            Cancelar venta
          </Boton>
          <Boton variante="contorno" onClick={onEditar} disabled={enviando}>
            Editar
          </Boton>
          <Boton onClick={onConfirmar} disabled={enviando}>
            {enviando
              ? esQrSimple
                ? 'Generando QR...'
                : 'Confirmando...'
              : esQrSimple
                ? 'Generar QR'
                : 'Confirmar cobro'}
          </Boton>
        </div>
      </div>
    </Tarjeta>
  )
}

export default ResumenCobro
