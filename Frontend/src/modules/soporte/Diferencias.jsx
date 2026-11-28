import { Alerta, Tabla, Tarjeta } from '../../components/ui'
import { nombreCampo, valorDiferencia } from './formato.js'

// TDSI-204: resultado de comparar la factura con su pago (las reglas las aplica el backend, TDSI-972).
function Diferencias({ comparacion }) {
  const { coincide, diferencias, avisos } = comparacion
  return (
    <>
      {coincide ? (
        <Alerta tono="exito" titulo="Sin diferencias">
          Los datos de la factura y del pago coinciden.
        </Alerta>
      ) : (
        <Alerta tono="advertencia" titulo="Revisión pendiente">
          {diferencias.length === 1
            ? 'La factura y el pago no coinciden en 1 dato.'
            : `La factura y el pago no coinciden en ${diferencias.length} datos.`}
        </Alerta>
      )}

      {avisos.map((aviso) => (
        <Alerta key={aviso} tono="info" titulo={aviso} />
      ))}

      {!coincide && (
        <Tarjeta titulo="Diferencias">
          <Tabla etiqueta="Diferencias entre la factura y el pago">
            <thead>
              <tr>
                <th>Dato</th>
                <th>Factura</th>
                <th>Pago</th>
                <th>Qué pasa</th>
              </tr>
            </thead>
            <tbody>
              {diferencias.map((d) => (
                <tr key={d.campo}>
                  <td>{nombreCampo(d.campo)}</td>
                  <td>{valorDiferencia(d.campo, d.factura)}</td>
                  <td>{valorDiferencia(d.campo, d.transaccion)}</td>
                  <td>{d.mensaje}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Tarjeta>
      )}
    </>
  )
}

export default Diferencias
