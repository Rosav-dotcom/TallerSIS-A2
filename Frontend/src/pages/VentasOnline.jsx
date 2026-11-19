import { useEffect, useState } from 'react'
import { listarVentasOnline, reenviarAvisoMarketplace } from '../api/ventasOnline.js'
import { Search } from 'lucide-react'
import { Alerta, Boton, CampoTexto, Chip, EstadoVacio, Modal, Selector, Tabla } from '../components/ui'
import './turno.css'
import './admin.css'

const ESTADOS = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'Pagado', etiqueta: 'Pagado' },
  { valor: 'Anulacion Pendiente', etiqueta: 'Anulación pendiente' },
  { valor: 'Anulado', etiqueta: 'Anulado' },
]

const TONO_ESTADO = {
  Pagado: 'exito',
  Anulado: 'neutro',
  'Anulacion Pendiente': 'advertencia',
}

// TDSI-51: estado del correo con la factura digital que se le manda al cliente final
// (distinto del aviso al Marketplace, que solo avisa que ya se emitio el numero).
const ETIQUETA_FACTURA_EMAIL = { ENVIADO: 'Enviado', SIMULADO: 'Simulado (sin SMTP)', ERROR: 'Error' }
const TONO_FACTURA_EMAIL = { ENVIADO: 'exito', SIMULADO: 'neutro', ERROR: 'error' }

const bs = (v) => Number(v ?? 0).toFixed(2)
const FILTROS_VACIOS = { desde: '', hasta: '', estado: '' }

// TDSI-180/688-691/957: pantalla "Ventas Online" del Administrador -- ventas reales
// que llegan del Marketplace (topico o POST /api/pagos/online). La factura se arma y
// se le manda al cliente por correo apenas llega la orden; el aviso de vuelta al
// Marketplace (Pub/Sub) queda pendiente de que el Administrador revise la factura en
// "Ver factura" y la apruebe.
function VentasOnline() {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)

  const [ventas, setVentas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [ventaSeleccionada, setVentaSeleccionada] = useState(null)
  const [enviandoMarketplace, setEnviandoMarketplace] = useState(false)
  const [errorMarketplace, setErrorMarketplace] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarVentasOnline(filtros)
      .then((r) => vigente && setVentas(r.data))
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [filtros])

  function buscar(event) {
    event.preventDefault()
    setFiltros({ desde, hasta, estado })
  }

  function limpiar() {
    setDesde('')
    setHasta('')
    setEstado('')
    setFiltros(FILTROS_VACIOS)
  }

  function abrirFactura(venta) {
    setVentaSeleccionada(venta)
    setErrorMarketplace(null)
  }

  function cerrarFactura() {
    setVentaSeleccionada(null)
    setErrorMarketplace(null)
  }

  // TDSI-51/957: ni el aviso al Marketplace ni la factura por correo al cliente se
  // mandan solos al emitir la factura -- el Administrador la revisa primero en este
  // modal y recien al aprobarla (este boton) se publica de verdad por Pub/Sub y,
  // si la orden trajo correo, se le manda ademas la factura digital al cliente.
  async function enviarAMarketplace() {
    if (!ventaSeleccionada?.numero_factura) return
    const { id } = ventaSeleccionada
    setEnviandoMarketplace(true)
    setErrorMarketplace(null)
    try {
      const { data } = await reenviarAvisoMarketplace(id)
      const nuevoEstado = data.publicado ? 'Enviado' : 'Error'
      const nuevoEstadoCorreo = data.facturaEmail?.envio?.estado
      setVentaSeleccionada((v) => (v ? { ...v, aviso_marketplace_estado: nuevoEstado, ...(nuevoEstadoCorreo && { factura_email_estado: nuevoEstadoCorreo }) } : v))
      setVentas((lista) => lista.map((v) => (v.id === id ? { ...v, aviso_marketplace_estado: nuevoEstado, ...(nuevoEstadoCorreo && { factura_email_estado: nuevoEstadoCorreo }) } : v)))
      if (!data.publicado) setErrorMarketplace(data.error || 'No se pudo publicar el aviso en Pub/Sub.')
    } catch (err) {
      setErrorMarketplace(err.message)
    } finally {
      setEnviandoMarketplace(false)
    }
  }

  const hayFiltros = filtros.desde || filtros.hasta || filtros.estado

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Ventas Online</h1>
        <p>
          Órdenes recibidas del Marketplace y su factura, ya emitida. El aviso de vuelta al Marketplace (y, si la orden
          trajo correo, el envío de la factura al cliente) queda pendiente de tu aprobación en "Ver factura".
        </p>
      </div>

      <form className="adm-filtros" onSubmit={buscar}>
        <CampoTexto
          etiqueta="Desde"
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(e) => setDesde(e.target.value)}
        />
        <CampoTexto
          etiqueta="Hasta"
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(e) => setHasta(e.target.value)}
        />
        <Selector etiqueta="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
          {ESTADOS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
        <Boton type="submit" icono={Search}>
          Buscar
        </Boton>
        {hayFiltros && (
          <Boton variante="contorno" onClick={limpiar}>
            Limpiar
          </Boton>
        )}
      </form>

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && ventas.length === 0 && (
        <EstadoVacio titulo="No hay ventas del Marketplace en este rango." />
      )}

      {!cargando && !error && ventas.length > 0 && (
        <div className="adm-tabla-ajustada">
          <Tabla etiqueta="Ventas online">
            <thead>
              <tr>
                <th>N° Orden</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Correo</th>
                <th className="ui-num">Total (Bs.)</th>
                <th>Método</th>
                <th>N° Factura</th>
                <th>Aviso al Marketplace</th>
                <th>Factura por correo</th>
                <th>Estado</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td className="adm-truncada" title={v.orden_id}>
                    {v.orden_id}
                  </td>
                  <td>{new Date(v.recibida_en).toLocaleString()}</td>
                  <td>{v.razon_social || v.cliente_id || 'Consumidor final'}</td>
                  <td className="adm-truncada" title={v.email || ''}>
                    {v.email || '—'}
                  </td>
                  <td className="ui-num">{bs(v.total)}</td>
                  <td>{v.metodo_pago}</td>
                  <td>
                    {v.numero_factura || <Chip tono="error">{v.factura_error ? 'Error al emitir' : 'Pendiente'}</Chip>}
                  </td>
                  <td>
                    {v.aviso_marketplace_estado ? (
                      <Chip tono={v.aviso_marketplace_estado === 'Enviado' ? 'exito' : 'neutro'}>
                        {v.aviso_marketplace_estado}
                      </Chip>
                    ) : v.numero_factura ? (
                      <Chip tono="advertencia">Pendiente de aprobación</Chip>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {v.factura_email_estado ? (
                      <Chip tono={TONO_FACTURA_EMAIL[v.factura_email_estado]}>
                        {ETIQUETA_FACTURA_EMAIL[v.factura_email_estado] ?? v.factura_email_estado}
                      </Chip>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Chip tono={TONO_ESTADO[v.estado]}>{v.estado}</Chip>
                  </td>
                  <td>
                    <div className="adm-acciones">
                      <Boton variante="fantasma" onClick={() => abrirFactura(v)}>
                        Ver factura
                      </Boton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </div>
      )}

      {ventaSeleccionada && (
        <Modal
          abierto
          ancho
          titulo={`Factura ${ventaSeleccionada.numero_factura || '(pendiente de emitir)'}`}
          onCerrar={cerrarFactura}
        >
          <div className="adm-form">
            <div>
              <p className="adm-nota">
                Orden {ventaSeleccionada.orden_id} · {new Date(ventaSeleccionada.recibida_en).toLocaleString()}
              </p>
              <p>
                <strong>Cliente:</strong>{' '}
                {ventaSeleccionada.razon_social || ventaSeleccionada.cliente_id || 'Consumidor final'}
                {ventaSeleccionada.nit && ` · ${ventaSeleccionada.tipo_documento || 'NIT'} ${ventaSeleccionada.nit}`}
              </p>
            </div>

            {/* TDSI-51/957: el aviso Pub/Sub al Marketplace no sale solo -- recien se
                publica cuando el Administrador revisa esta factura y la aprueba aca. */}
            <div className="adm-aprobacion">
              <Boton
                onClick={enviarAMarketplace}
                disabled={
                  !ventaSeleccionada.numero_factura ||
                  ventaSeleccionada.aviso_marketplace_estado === 'Enviado' ||
                  enviandoMarketplace
                }
                title={!ventaSeleccionada.numero_factura ? 'Todavía no tiene una factura emitida' : undefined}
              >
                {enviandoMarketplace ? 'Enviando...' : 'Aprobar y enviar a Marketplace (Pub/Sub)'}
              </Boton>
              {ventaSeleccionada.aviso_marketplace_estado ? (
                <Chip tono={ventaSeleccionada.aviso_marketplace_estado === 'Enviado' ? 'exito' : 'neutro'}>
                  {ventaSeleccionada.aviso_marketplace_estado}
                </Chip>
              ) : ventaSeleccionada.numero_factura ? (
                <span className="adm-nota">
                  Revisa la factura y aprueba para avisarle al Marketplace
                  {ventaSeleccionada.email ? ' y mandarle la factura al cliente por correo.' : '.'}
                </span>
              ) : null}
            </div>
            {errorMarketplace && <Alerta tono="error" titulo={errorMarketplace} />}

            <Tabla etiqueta="Ítems de la orden">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th className="ui-num">Cantidad</th>
                  <th className="ui-num">Precio unit. (Bs.)</th>
                  <th className="ui-num">Subtotal (Bs.)</th>
                </tr>
              </thead>
              <tbody>
                {ventaSeleccionada.items.map((it, i) => (
                  <tr key={it.sku ?? i}>
                    <td>{it.descripcion || it.sku}</td>
                    <td className="ui-num">{it.cantidad}</td>
                    <td className="ui-num">{bs(it.precio_unitario)}</td>
                    <td className="ui-num">{bs(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={3}>Total</th>
                  <td className="ui-num">{bs(ventaSeleccionada.total)}</td>
                </tr>
              </tfoot>
            </Tabla>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default VentasOnline
