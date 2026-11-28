import { useParams } from 'react-router-dom'
import { EstadoCargando, EstadoError, EstadoVacio } from '../../components/ui'
import DatosComprobante from './DatosComprobante.jsx'
import { mensajeDeError } from './formato.js'
import { useComprobanteReembolso } from './useComprobanteReembolso.js'
import './pagos.css'

// TDSI-236: página "Comprobante de reembolso" (/devoluciones/:codigo/comprobante). La abre el
// Encargado de Devoluciones desde el detalle de la devolución (Equipo 1 solo enlaza aquí).
function ComprobanteReembolso() {
  const { codigo } = useParams()
  const c = useComprobanteReembolso(codigo)

  return (
    <section className="pag-pagina">
      <header className="pag-encabezado">
        <h1>Comprobante de reembolso</h1>
        <p>Devolución {codigo}</p>
      </header>

      {c.cargando && !c.envio && <EstadoCargando lineas={6} texto="Cargando el comprobante…" />}
      {!c.cargando && c.error && <EstadoError texto={mensajeDeError(c.error)} onReintentar={c.recargar} />}
      {!c.cargando && !c.error && !c.envio && (
        <EstadoVacio
          titulo="Todavía no hay comprobante"
          texto={`La devolución ${codigo} aún no envió su comprobante al cliente. Se envía al terminar la devolución.`}
        />
      )}
      {!c.error && c.envio && (
        <div className="pag-columnas">
          <DatosComprobante comprobante={c.envio.comprobante} />
        </div>
      )}
    </section>
  )
}

export default ComprobanteReembolso
