// TDSI-160/790: vuelto a entregar con el desglose sugerido en fichas de billetes y monedas.
// TDSI-792: si el monto recibido es exacto, se muestra "Sin vuelto".
// El desglose lo calcula el backend y es solo una sugerencia: no cambia como se registra el pago.

// En Bolivia los billetes van de Bs 10 a Bs 200; de ahi para abajo son monedas.
const MENOR_BILLETE = 10

function etiquetaDenominacion(denominacion) {
  return `Bs ${Number.isInteger(denominacion) ? denominacion : denominacion.toFixed(2)}`
}

function DesgloseVuelto({ vuelto, desglose = [] }) {
  if (vuelto === 0) {
    return (
      <div className="cob-vuelto">
        <span className="cob-vuelto-monto">Sin vuelto</span>
      </div>
    )
  }

  return (
    <div className="cob-vuelto">
      <div className="cob-vuelto-cabecera">
        <span className="cob-vuelto-etiqueta">Vuelto a entregar</span>
        <span className="cob-vuelto-monto">Bs. {vuelto.toFixed(2)}</span>
      </div>
      <span className="cob-vuelto-etiqueta">Desglose sugerido</span>
      <ul className="cob-desglose">
        {desglose.map(({ denominacion, cantidad }) => {
          const esBillete = denominacion >= MENOR_BILLETE
          return (
            <li
              key={denominacion}
              className={esBillete ? 'cob-desglose-billete' : 'cob-desglose-moneda'}
              aria-label={`${cantidad} ${esBillete ? 'billete' : 'moneda'}${cantidad === 1 ? '' : 's'} de ${etiquetaDenominacion(denominacion)}`}
            >
              <span>{cantidad} ×</span>
              <span>{etiquetaDenominacion(denominacion)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default DesgloseVuelto
