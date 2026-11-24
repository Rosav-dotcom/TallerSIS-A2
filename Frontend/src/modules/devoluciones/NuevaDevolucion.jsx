import { ScanBarcode, Search } from 'lucide-react'
import { Alerta, Boton, EstadoCargando, EstadoError, EstadoVacio, Icono, Pasos, Tabla, Tarjeta } from '../../components/ui'
import useNuevaDevolucion from './useNuevaDevolucion.js'
import './devoluciones.css'

const dinero = (valor) => `Bs ${Number(valor || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fecha = (valor) => valor ? new Date(valor).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

function DetalleComprobante({ comprobante }) {
  return (
    <Tarjeta titulo={`Comprobante ${comprobante.numero}`}>
      <div className="dev-datos">
        <p><strong>Cliente</strong><span>{comprobante.cliente_nombre || 'Sin nombre'}</span></p>
        <p><strong>NIT / CI</strong><span>{comprobante.cliente_nit || '—'}</span></p>
        <p><strong>Fecha de emisión</strong><span>{fecha(comprobante.fecha)}</span></p>
        <p><strong>Canal</strong><span>{comprobante.canal || '—'}</span></p>
        <p><strong>Estado</strong><span>{comprobante.estado || '—'}</span></p>
        <p><strong>Pago original</strong><span>{comprobante.metodo_pago || 'No registrado'}</span></p>
      </div>
      <h3 className="dev-subtitulo">Ítems de la compra</h3>
      <Tabla etiqueta="Productos del comprobante">
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
        <tbody>
          {(comprobante.items || []).map((item, i) => <tr key={`${item.descripcion}-${i}`}>
            <td>{item.descripcion}</td><td>{item.cantidad}</td>
            <td className="ui-num">{dinero(item.precio_unitario)}</td>
            <td className="ui-num">{dinero(item.subtotal)}</td>
          </tr>)}
        </tbody>
      </Tabla>
      <div className="dev-totales">
        <span>Subtotal: {dinero(comprobante.subtotal)}</span>
        <span>Descuento: {dinero(comprobante.descuento)}</span>
        <span>Impuesto: {dinero(comprobante.impuesto)}</span>
        <strong>Total: {dinero(comprobante.total)}</strong>
      </div>
      {comprobante.metodos_pago?.length > 1 && <div className="dev-metodos">
        {comprobante.metodos_pago.map((p, i) => <span key={i}>{p.metodo}: {dinero(p.monto)}</span>)}
      </div>}
    </Tarjeta>
  )
}

export default function NuevaDevolucion() {
  const { consulta, setConsulta, comprobante, compras, cargando, error, buscar, elegirCompra, reintentar } = useNuevaDevolucion()
  return (
    <div className="dev-pagina">
      <h1>Nueva devolución</h1>
      <p className="dev-descripcion">Busca el comprobante original para comenzar una devolución.</p>
      <Pasos pasos={['Comprobante', 'Ítems', 'Motivo', 'Reembolso']} actual={0} />
      <div className="dev-columnas">
        <div className="dev-principal">
          <Tarjeta titulo="Paso 1 · Comprobante">
            <form onSubmit={buscar} className="dev-busqueda">
              <label htmlFor="dev-consulta">Código de barras, N.º de factura o NIT/CI</label>
              <div className="dev-busqueda-fila">
                <span className="dev-control">
                  <Icono icono={Search} />
                  <input id="dev-consulta" value={consulta} maxLength={100} onChange={(e) => setConsulta(e.target.value)}
                    placeholder="Factura o NIT" autoComplete="off" aria-describedby="dev-lector" />
                  <span title="Utiliza un lector de código de barras compatible con teclado"><Icono icono={ScanBarcode} /></span>
                </span>
                <Boton type="submit" disabled={cargando}>Buscar</Boton>
              </div>
              <small id="dev-lector">Puedes escanear el código de barras con un lector tipo teclado y presionar Enter.</small>
            </form>
          </Tarjeta>
          {cargando && <EstadoCargando texto="Buscando comprobantes…" />}
          {!cargando && error && (error === 'Comprobante no encontrado o anulado' ?
            <Alerta tono="error" titulo={error} /> :
            <EstadoError titulo="No se pudo completar la búsqueda" texto={error} onReintentar={reintentar} />)}
          {!cargando && compras.length > 0 && <Tarjeta titulo="Compras del cliente">
            <p>Selecciona la factura que deseas consultar.</p>
            <Tabla etiqueta="Compras del cliente"><thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th>Importe</th><th>Acción</th></tr></thead>
              <tbody>{compras.map((c) => <tr key={c.numero}>
                <td>{c.numero}</td><td>{c.cliente_nombre}</td><td>{fecha(c.fecha)}</td><td className="ui-num">{dinero(c.total)}</td>
                <td><Boton variante="contorno" onClick={() => elegirCompra(c.numero)}>Ver detalle</Boton></td>
              </tr>)}</tbody>
            </Tabla>
          </Tarjeta>}
          {!cargando && comprobante && <DetalleComprobante comprobante={comprobante} />}
          {!cargando && !error && !comprobante && compras.length === 0 && <EstadoVacio titulo="Busca un comprobante" texto="Introduce el número de factura, NIT/CI o código de barras para ver la compra original." />}
          <div className="dev-acciones"><Boton disabled title="Los siguientes pasos se habilitarán en TDSI-69 y TDSI-70">Continuar</Boton></div>
        </div>
        <aside className="dev-resumen">
          <Tarjeta titulo="Resumen">
            {comprobante ? <>
              <p><strong>Factura</strong><span>{comprobante.numero}</span></p>
              <p><strong>Cliente</strong><span>{comprobante.cliente_nombre || '—'}</span></p>
              <p><strong>Método de pago</strong><span>{comprobante.metodo_pago || '—'}</span></p>
              <p><strong>Ítems comprados</strong><span>{(comprobante.items || []).length}</span></p>
              <p className="dev-resumen-total"><strong>Total compra</strong><strong>{dinero(comprobante.total)}</strong></p>
            </> : <p>Selecciona un comprobante para ver los datos de la operación.</p>}
            <p className="dev-nota">El monto a devolver se calculará al seleccionar ítems en el siguiente paso.</p>
          </Tarjeta>
        </aside>
      </div>
    </div>
  )
}
