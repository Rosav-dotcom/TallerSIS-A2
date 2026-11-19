import { useEffect, useState } from 'react'
import { listarCajeros, listarMisFacturas, urlFacturaPdf } from '../api/pagos.js'
import { Alerta, Boton, CampoTexto, Chip, EstadoVacio, Modal, Tabla } from '../components/ui'
import './turno.css'
import './admin.css'

// TDSI-329: el administrador ve todos los cajeros que han trabajado (registraron
// al menos una venta) y, al elegir uno, lo que ha facturado desde que empezó,
// con filtro de fechas.
function Cajeros() {
  const [cajeros, setCajeros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [cajeroSeleccionado, setCajeroSeleccionado] = useState(null)
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [facturas, setFacturas] = useState([])
  const [cargandoFacturas, setCargandoFacturas] = useState(false)
  const [errorFacturas, setErrorFacturas] = useState(null)

  useEffect(() => {
    listarCajeros()
      .then((r) => setCajeros(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (!cajeroSeleccionado) return
    setCargandoFacturas(true)
    setErrorFacturas(null)
    listarMisFacturas(cajeroSeleccionado, { desde: filtroDesde, hasta: filtroHasta })
      .then((r) => setFacturas(r.data))
      .catch((err) => setErrorFacturas(err.message))
      .finally(() => setCargandoFacturas(false))
  }, [cajeroSeleccionado, filtroDesde, filtroHasta])

  function seleccionarCajero(cajero) {
    setCajeroSeleccionado(cajero)
    setFiltroDesde('')
    setFiltroHasta('')
  }

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Cajeros</h1>
        <p>Cajeros que han registrado ventas en el sistema. Elija uno para ver lo que ha facturado.</p>
      </div>

      {cargando && <p className="adm-nota">Cargando...</p>}
      {error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && cajeros.length === 0 && (
        <EstadoVacio titulo="Todavía no hay ventas registradas por ningún cajero." />
      )}

      {cajeros.length > 0 && (
        <Tabla etiqueta="Cajeros">
          <thead>
            <tr>
              <th>Cajero</th>
              <th className="ui-num">Ventas</th>
              <th className="ui-num">Total facturado (Bs.)</th>
              <th>Última venta</th>
              <th aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {cajeros.map((c) => (
              <tr key={c.cajero}>
                <td>{c.cajero}</td>
                <td className="ui-num">{c.cantidadVentas}</td>
                <td className="ui-num">{c.totalFacturado.toFixed(2)}</td>
                <td>{new Date(c.ultimaVenta).toLocaleString()}</td>
                <td>
                  <div className="adm-acciones">
                    <Boton
                      variante={cajeroSeleccionado === c.cajero ? 'primario' : 'contorno'}
                      onClick={() => seleccionarCajero(c.cajero)}
                    >
                      Ver facturas
                    </Boton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      {cajeroSeleccionado && (
        <Modal abierto ancho titulo={`Facturas de ${cajeroSeleccionado}`} onCerrar={() => setCajeroSeleccionado(null)}>
          <div className="adm-form">
            <div className="adm-filtros">
              <CampoTexto
                etiqueta="Desde"
                type="date"
                value={filtroDesde}
                max={filtroHasta || undefined}
                onChange={(e) => setFiltroDesde(e.target.value)}
              />
              <CampoTexto
                etiqueta="Hasta"
                type="date"
                value={filtroHasta}
                min={filtroDesde || undefined}
                onChange={(e) => setFiltroHasta(e.target.value)}
              />
              {(filtroDesde || filtroHasta) && (
                <Boton
                  variante="contorno"
                  onClick={() => {
                    setFiltroDesde('')
                    setFiltroHasta('')
                  }}
                >
                  Quitar filtro
                </Boton>
              )}
            </div>

            {cargandoFacturas && <p className="adm-nota">Cargando...</p>}
            {errorFacturas && <Alerta tono="error" titulo={`Error: ${errorFacturas}`} />}
            {!cargandoFacturas && !errorFacturas && facturas.length === 0 && (
              <p className="adm-nota">
                {filtroDesde || filtroHasta
                  ? 'No hay facturas en ese rango de fechas.'
                  : 'Este cajero todavía no tiene facturas.'}
              </p>
            )}

            {facturas.length > 0 && (
              <div className="adm-sin-cortes">
                <Tabla etiqueta={`Facturas de ${cajeroSeleccionado}`}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Método(s)</th>
                      <th className="ui-num">Total (Bs.)</th>
                      <th>Estado</th>
                      <th aria-label="Acciones"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((f) => (
                      <tr key={f.id_transaccion}>
                        <td>{f.id_transaccion}</td>
                        <td>{new Date(f.fecha).toLocaleString()}</td>
                        <td>{f.razon_social || 'Consumidor final'}</td>
                        <td>{f.metodos.join(' + ')}</td>
                        <td className="ui-num">{f.total.toFixed(2)}</td>
                        <td>
                          <Chip tono={f.estado === 'Registrado' ? 'exito' : 'neutro'}>
                            {f.estado === 'Registrado' ? 'Emitida' : 'Anulada'}
                          </Chip>
                        </td>
                        <td>
                          <div className="adm-acciones">
                            <a
                              href={urlFacturaPdf(f.id_transaccion)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ui-boton ui-boton--fantasma"
                            >
                              Ver
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

export default Cajeros
