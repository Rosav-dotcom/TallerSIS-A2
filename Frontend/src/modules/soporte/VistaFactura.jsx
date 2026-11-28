import { Chip, Tabla, Tarjeta } from '../../components/ui'
import DatosOperacion from './DatosOperacion.jsx'
import MetodosPago from './MetodosPago.jsx'
import { estadoFactura, fecha, monto, texto } from './formato.js'

// TDSI-1065: factura en solo lectura. Soporte no anula ni modifica: no lleva acciones.
// campos: los campos que no coinciden con el pago (Set).
function VistaFactura({ factura, campos }) {
  const estado = estadoFactura(factura.estado)
  return (
    <Tarjeta titulo={`Factura ${factura.numero}`} acciones={<Chip tono={estado.tono}>{estado.texto}</Chip>}>
      <div className="sop-vista">
        <DatosOperacion
          datos={[
            { etiqueta: 'Fecha', valor: fecha(factura.fecha) },
            { etiqueta: 'Estado', valor: estado.texto, difiere: campos.has('estado') || campos.has('estado_pago') },
            { etiqueta: 'Canal', valor: texto(factura.canal) },
            {
              etiqueta: 'Transacción',
              valor: texto(factura.venta_id),
              difiere: campos.has('referencia') || campos.has('transaccion'),
            },
            { etiqueta: 'Cliente', valor: texto(factura.cliente.nombre), difiere: campos.has('cliente.razon_social') },
            { etiqueta: 'NIT/CI', valor: texto(factura.cliente.nit), difiere: campos.has('cliente.nit') },
          ]}
        />

        <h3 className="sop-subtitulo">Ítems</h3>
        {factura.items.length === 0 ? (
          <p className="sop-nota">La factura no tiene ítems registrados.</p>
        ) : (
          <Tabla etiqueta="Ítems de la factura">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="ui-num">Cantidad</th>
                <th className="ui-num">Precio</th>
                <th className="ui-num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {factura.items.map((it, i) => (
                <tr key={`${it.descripcion}-${i}`}>
                  <td>{it.descripcion}</td>
                  <td className="ui-num">{it.cantidad}</td>
                  <td className="ui-num">{monto(it.precio_unitario)}</td>
                  <td className="ui-num">{monto(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}

        <DatosOperacion
          datos={[
            { etiqueta: 'Subtotal', valor: monto(factura.subtotal) },
            { etiqueta: 'Descuento', valor: monto(factura.descuento) },
            { etiqueta: 'Impuesto', valor: monto(factura.impuesto) },
            { etiqueta: 'Total', valor: <strong>{monto(factura.total)}</strong>, difiere: campos.has('total') },
          ]}
        />

        <h3 className="sop-subtitulo">Métodos de pago</h3>
        {factura.metodos_pago.length === 0 ? (
          <p className="sop-nota">La factura no registra métodos de pago.</p>
        ) : (
          <MetodosPago metodos={factura.metodos_pago} campos={campos} />
        )}
      </div>
    </Tarjeta>
  )
}

export default VistaFactura
