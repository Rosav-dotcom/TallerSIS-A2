import { Banknote, CircleDollarSign, CreditCard, QrCode } from 'lucide-react'
import { BotonOpcion } from '../../components/ui'
import { EFECTIVO_USD } from './constantes.js'

const METODOS_PAGO = [
  { id: 'Efectivo', etiqueta: 'Efectivo', icono: Banknote },
  { id: EFECTIVO_USD, etiqueta: 'Efectivo en dólares', icono: CircleDollarSign },
  { id: 'Tarjeta', etiqueta: 'Tarjeta', icono: CreditCard },
  { id: 'QR', etiqueta: 'QR', icono: QrCode },
]

// Botones de método de pago (hasta 2 para un pago mixto).
function SeccionMetodoPago({ metodos, esMixto, onToggleMetodo }) {
  return (
    <fieldset className="cob-grupo">
      <legend>Método de pago (puede elegir hasta 2 para un pago mixto)</legend>
      <div className="cob-metodos">
        {METODOS_PAGO.map((metodo) => (
          <BotonOpcion
            key={metodo.id}
            icono={metodo.icono}
            activa={metodos.includes(metodo.id)}
            onClick={() => onToggleMetodo(metodo.id)}
          >
            {metodo.etiqueta}
          </BotonOpcion>
        ))}
      </div>
      {esMixto && <p className="cob-nota">Pago mixto: complete los montos en el panel de la derecha.</p>}
    </fieldset>
  )
}

export default SeccionMetodoPago
