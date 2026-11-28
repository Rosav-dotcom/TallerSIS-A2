import { Tabla, Tarjeta } from '../../components/ui'
import { TIPOS } from './catalogos.js'
import { texto } from './formato.js'

const TEXTO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto]))
const NUMERO = new Intl.NumberFormat('es-BO')
const PORCENTAJE = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 })

// TDSI-1075: los 5 tipos de problema más frecuentes del rango (TDSI-1095), de mayor a menor.
function TablaProblemasFrecuentes({ problemas }) {
  return (
    <Tarjeta titulo="Problemas más frecuentes">
      <Tabla etiqueta="Problemas más frecuentes del rango">
        <thead>
          <tr>
            <th className="ui-num">#</th>
            <th>Tipo de problema</th>
            <th className="ui-num">Incidentes</th>
            <th className="ui-num">Sin resolver</th>
            <th className="ui-num">% del total</th>
          </tr>
        </thead>
        <tbody>
          {problemas.map((p) => (
            <tr key={p.tipo}>
              <td className="ui-num">{p.posicion}</td>
              <td>{TEXTO_TIPO[p.tipo] ?? texto(p.tipo)}</td>
              <td className="ui-num">{NUMERO.format(p.cantidad)}</td>
              <td className="ui-num">{NUMERO.format(p.sin_resolver)}</td>
              <td className="ui-num">{PORCENTAJE.format(p.porcentaje)} %</td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </Tarjeta>
  )
}

export default TablaProblemasFrecuentes
