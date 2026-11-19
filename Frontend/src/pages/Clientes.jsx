import { useState } from 'react'
import { historialCliente, urlFacturaPdf } from '../api/pagos.js'
import { Search } from 'lucide-react'
import { Alerta, Boton, CampoTexto, Chip, Tabla, TarjetaKpi } from '../components/ui'
import './turno.css'
import './admin.css'

const TIPOS_DOCUMENTO = [
  { id: 'NIT', etiqueta: 'NIT' },
  { id: 'CI', etiqueta: 'CI' },
]

// TDSI-327: el administrador busca cualquier cliente por NIT o CI y ve cuantas
// veces vino y que ha facturado cada vez.
function Clientes() {
  const [tipoDocumento, setTipoDocumento] = useState('NIT')
  const [numero, setNumero] = useState('')
  const [cliente, setCliente] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [buscado, setBuscado] = useState(false)

  async function buscar(event) {
    event.preventDefault()
    if (!numero.trim()) {
      setError('Ingrese el número de NIT o CI a buscar.')
      return
    }

    setCargando(true)
    setError(null)
    setBuscado(true)
    try {
      const respuesta = await historialCliente(tipoDocumento, numero.trim())
      setCliente(respuesta.data)
    } catch (err) {
      setCliente(null)
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Buscar cliente</h1>
        <p>Busque un cliente por NIT o CI para ver cuántas veces vino y lo que ha facturado.</p>
      </div>

      <form onSubmit={buscar} className="adm-filtros">
        <div className="ui-campo">
          <span className="ui-campo-etiqueta">Documento</span>
          <div className="adm-segmento" role="group" aria-label="Tipo de documento">
            {TIPOS_DOCUMENTO.map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                className={tipoDocumento === tipo.id ? 'adm-segmento--activa' : ''}
                aria-pressed={tipoDocumento === tipo.id}
                onClick={() => setTipoDocumento(tipo.id)}
              >
                {tipo.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <CampoTexto
          etiqueta={`Número de ${tipoDocumento}`}
          type="text"
          inputMode="numeric"
          maxLength={tipoDocumento === 'NIT' ? 10 : 8}
          value={numero}
          onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
        />

        <Boton type="submit" icono={Search} disabled={cargando}>
          {cargando ? 'Buscando...' : 'Buscar'}
        </Boton>
      </form>

      {error && <Alerta tono="error" titulo={error} />}

      {buscado && !cargando && !error && cliente && (
        <>
          <div>
            <h2 className="adm-subtitulo">{cliente.razon_social || 'Cliente'}</h2>
            <p className="adm-nota">
              {cliente.tipo_documento}: {cliente.numero}
            </p>
          </div>

          <div className="adm-kpis">
            <TarjetaKpi titulo="Veces que vino" valor={cliente.cantidadCompras} />
            <TarjetaKpi titulo="Total gastado" valor={`Bs. ${cliente.totalGastado.toFixed(2)}`} />
            {cliente.cantidadAnuladas > 0 && (
              <div className="adm-kpi--error">
                <TarjetaKpi titulo="Facturas anuladas" valor={cliente.cantidadAnuladas} />
              </div>
            )}
          </div>

          <Tabla etiqueta="Facturas del cliente">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Método(s)</th>
                <th className="ui-num">Total (Bs.)</th>
                <th>Cajero</th>
                <th>Estado</th>
                <th aria-label="Acciones"></th>
              </tr>
            </thead>
            <tbody>
              {cliente.facturas.map((f) => (
                <tr key={f.id_transaccion}>
                  <td>{f.id_transaccion}</td>
                  <td>{new Date(f.fecha).toLocaleString()}</td>
                  <td>{f.metodos.join(' + ')}</td>
                  <td className="ui-num">{f.total.toFixed(2)}</td>
                  <td>{f.cajero || '-'}</td>
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
        </>
      )}
    </section>
  )
}

export default Clientes
