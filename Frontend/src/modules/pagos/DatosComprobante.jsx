import { Tarjeta } from '../../components/ui'
import { fecha, fechaHora, monto, texto } from './formato.js'

// Forma de reembolso como la ve el cliente.
const FORMA = { Tarjeta: 'Reversión a la tarjeta', Vale: 'Vale de compra', Efectivo: 'Efectivo', QR: 'QR' }

// TDSI-236: datos de la devolución, importe y forma de reembolso (lo mismo que recibió el cliente).
function DatosComprobante({ comprobante }) {
  const r = comprobante.reembolso
  const filas = [
    { etiqueta: 'Devolución', valor: comprobante.devolucion_id },
    { etiqueta: 'Fecha', valor: fechaHora(comprobante.fecha) },
    { etiqueta: 'Cliente', valor: texto(comprobante.cliente) },
    { etiqueta: 'Nota de crédito', valor: texto(comprobante.nota_credito) },
  ]
  if (r) {
    filas.push(
      { etiqueta: 'Forma de reembolso', valor: FORMA[r.metodo] ?? r.metodo },
      { etiqueta: r.metodo === 'Vale' ? 'Código del vale' : 'Referencia', valor: texto(r.referencia) },
    )
    if (r.expira_en) filas.push({ etiqueta: 'Vence', valor: fecha(r.expira_en) })
  }

  return (
    <Tarjeta titulo="Comprobante">
      <dl className="pag-datos">
        {filas.map((f) => (
          <div key={f.etiqueta} className="pag-dato">
            <dt>{f.etiqueta}</dt>
            <dd>{f.valor}</dd>
          </div>
        ))}
      </dl>
      {r ? (
        <div className="pag-importe">
          <span>Importe reembolsado</span>
          <strong>{monto(r.monto)}</strong>
        </div>
      ) : (
        <p className="pag-nota">Esta devolución solo tiene nota de crédito, sin reembolso de dinero.</p>
      )}
    </Tarjeta>
  )
}

export default DatosComprobante
