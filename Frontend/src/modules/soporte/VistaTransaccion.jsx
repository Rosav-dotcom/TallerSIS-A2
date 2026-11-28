import { Chip, LineaTiempo, Tarjeta } from '../../components/ui'
import DatosOperacion from './DatosOperacion.jsx'
import MetodosPago from './MetodosPago.jsx'
import { estadoPago, estadoTransaccion, fecha, monto, texto } from './formato.js'

// El backend manda el historial del cambio más nuevo al más antiguo; la línea de tiempo va en orden cronológico.
function eventosDelHistorial({ historial, fecha: registrada, cajero }) {
  const cambios = [...historial].reverse().map((h, i) => ({
    id: `${h.cambiado_en}-${i}`,
    titulo: `${fecha(h.cambiado_en)} · ${estadoPago(h.estado_nuevo).texto}`,
    detalle: [h.motivo, h.origen].filter(Boolean).join(' · '),
    hecho: h.estado_nuevo !== 'PENDIENTE',
  }))
  return [
    { id: 'registro', titulo: `${fecha(registrada)} · Pago registrado`, detalle: cajero, hecho: true },
    ...cambios,
  ]
}

// TDSI-1067: transacción en solo lectura, con el chip de su estado y su historial.
// campos: los campos que no coinciden con la factura (Set).
function VistaTransaccion({ transaccion, campos }) {
  const estado = estadoTransaccion(transaccion)
  return (
    <Tarjeta titulo={`Pago ${transaccion.id_transaccion}`} acciones={<Chip tono={estado.tono}>{estado.texto}</Chip>}>
      <div className="sop-vista">
        <DatosOperacion
          datos={[
            { etiqueta: 'Fecha', valor: fecha(transaccion.fecha) },
            { etiqueta: 'Estado', valor: texto(transaccion.estado), difiere: campos.has('estado') },
            {
              etiqueta: 'Resultado del cobro',
              valor: estadoPago(transaccion.estado_pago).texto,
              difiere: campos.has('estado_pago'),
            },
            { etiqueta: 'Transacción', valor: transaccion.id_transaccion, difiere: campos.has('referencia') },
            {
              etiqueta: 'Cliente',
              valor: texto(transaccion.cliente.razon_social),
              difiere: campos.has('cliente.razon_social'),
            },
            {
              etiqueta: transaccion.cliente.tipo_documento || 'NIT/CI',
              valor: texto(transaccion.cliente.nit),
              difiere: campos.has('cliente.nit'),
            },
            { etiqueta: 'Tipo de pago', valor: texto(transaccion.tipo_pago) },
            { etiqueta: 'Caja', valor: texto(transaccion.caja_id) },
            { etiqueta: 'Cajero', valor: texto(transaccion.cajero) },
            { etiqueta: 'Total', valor: <strong>{monto(transaccion.total)}</strong>, difiere: campos.has('total') },
          ]}
        />

        <h3 className="sop-subtitulo">Métodos de pago</h3>
        <MetodosPago metodos={transaccion.metodos} campos={campos} />

        <h3 className="sop-subtitulo">Historial</h3>
        <LineaTiempo eventos={eventosDelHistorial(transaccion)} />
      </div>
    </Tarjeta>
  )
}

export default VistaTransaccion
