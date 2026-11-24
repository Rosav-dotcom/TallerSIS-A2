import { Tabla } from '../../components/ui'
import { monto } from './formato.js'

// Métodos y montos de una factura o de una transacción (varias filas en el pago mixto).
function MetodosPago({ metodos, campos }) {
  return (
    <Tabla etiqueta="Métodos de pago">
      <thead>
        <tr>
          <th>Método</th>
          <th className="ui-num">Monto</th>
        </tr>
      </thead>
      <tbody>
        {metodos.map((m, i) => (
          <tr key={`${m.metodo}-${i}`}>
            <td>
              {m.metodo}
              {campos.has(`metodo_pago.${m.metodo}`) && <span className="sop-marca">No coincide</span>}
            </td>
            <td className="ui-num">{monto(m.monto)}</td>
          </tr>
        ))}
      </tbody>
    </Tabla>
  )
}

export default MetodosPago
