import { Boton, Modal, Tabla } from './ui'

// TDSI-829/830: aviso de que esta venta parece repetir un cobro reciente al mismo cliente.
// TDSI-831: compara el cobro anterior con la venta actual. Las ventas todavia no guardan
// items (el proyecto no tiene catalogo de productos), asi que se compara lo que si registran.
function AvisoCobroDuplicadoModal({ factura, segundos, anterior, actual, onCancelar, onCobrarIgual }) {
  const totalAnterior = anterior?.total ?? actual.total
  const tiempo = segundos === 1 ? '1 segundo' : `${segundos} segundos`

  return (
    <Modal
      abierto
      rol="alertdialog"
      titulo="Posible cobro repetido"
      onCerrar={onCancelar}
      ancho
      acciones={
        <>
          <Boton variante="contorno" onClick={onCancelar} autoFocus>
            Cancelar
          </Boton>
          <Boton variante="peligro" onClick={onCobrarIgual}>
            Cobrar igual
          </Boton>
        </>
      }
    >
      <div className="cob-bloque">
        <p>
          Ya cobraste Bs {totalAnterior.toFixed(2)} a este cliente hace {tiempo} (Factura N° {factura}). ¿Seguro que
          quieres cobrar de nuevo?
        </p>

        {anterior ? (
          <Tabla etiqueta="Comparación con el cobro anterior">
            <thead>
              <tr>
                <th></th>
                <th>Cobro anterior</th>
                <th>Esta venta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Total</th>
                <td className="ui-num">Bs {anterior.total.toFixed(2)}</td>
                <td className="ui-num">Bs {actual.total.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Método</th>
                <td>{anterior.metodos.join(' + ')}</td>
                <td>{actual.metodos.join(' + ')}</td>
              </tr>
              <tr>
                <th>Cliente</th>
                <td>{anterior.razon_social || '-'}</td>
                <td>{actual.razonSocial || '-'}</td>
              </tr>
            </tbody>
          </Tabla>
        ) : (
          <p className="cob-nota">No se pudo cargar el detalle del cobro anterior.</p>
        )}
      </div>
    </Modal>
  )
}

export default AvisoCobroDuplicadoModal
