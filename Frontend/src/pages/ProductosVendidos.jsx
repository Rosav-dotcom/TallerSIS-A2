import { useEffect, useState } from 'react'
import { obtenerProductosVendidos, enviarProductosACompras } from '../api/productosVendidos.js'
import { Send } from 'lucide-react'
import { Alerta, Boton, CampoTexto, Chip, EstadoVacio, Modal, Tabla } from '../components/ui'
import './turno.css'
import './admin.css'

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const bs = (v) => Number(v ?? 0).toFixed(2)

const ETIQUETA_ENVIO = { Enviado: 'Enviado', Recibido: 'Recibido por Compras', Error: 'Error' }
const TONO_ENVIO = { Enviado: 'info', Recibido: 'exito', Error: 'error' }

// TDSI-186/712-715: pantalla "Productos Vendidos" del Administrador -- productos del
// dia (solo ventas del Marketplace, que son las unicas con desglose por item) y el
// envio del reporte diario a Compras.
function ProductosVendidos() {
  const [fecha, setFecha] = useState(hoyLocal)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState(null)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    setMensaje(null)
    obtenerProductosVendidos(fecha)
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, recargar])

  const hayProductos = datos && datos.productos.length > 0
  const totalUnidades = hayProductos ? datos.productos.reduce((acc, p) => acc + p.cantidad, 0) : 0
  const totalMonto = hayProductos ? datos.productos.reduce((acc, p) => acc + p.monto, 0) : 0

  // TDSI-719/720: ya se envio con exito (Enviado o Recibido) o no hay nada que enviar.
  const yaEnviado = datos?.envio && datos.envio.estado !== 'Error'
  const puedeEnviar = hayProductos && !yaEnviado

  async function confirmarEnvio() {
    setEnviando(true)
    setErrorEnvio(null)
    try {
      await enviarProductosACompras(fecha)
      setConfirmando(false)
      setMensaje('Reporte enviado a Compras.')
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEnvio(err.mensaje || err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Productos Vendidos</h1>
        <p>Productos vendidos en el día (ventas del Marketplace) y el envío del reporte diario a Compras.</p>
      </div>

      <div className="adm-filtros">
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          value={fecha}
          max={hoyLocal()}
          onChange={(e) => setFecha(e.target.value)}
        />
        <Boton icono={Send} onClick={() => setConfirmando(true)} disabled={!puedeEnviar}>
          Enviar a Compras
        </Boton>
        {datos?.envio && (
          <span className="adm-dato">
            <Chip tono={TONO_ENVIO[datos.envio.estado]}>
              {ETIQUETA_ENVIO[datos.envio.estado] ?? datos.envio.estado}
            </Chip>
          </span>
        )}
      </div>

      {datos?.envio?.estado === 'Error' && (
        <Alerta tono="error" titulo={`No se pudo enviar el reporte: ${datos.envio.ultimoError}`} />
      )}
      {datos?.envio?.enviadoEn && (
        <p className="adm-nota">
          Enviado el {new Date(datos.envio.enviadoEn).toLocaleString()}
          {datos.envio.recibidoEn && ` · Recibido el ${new Date(datos.envio.recibidoEn).toLocaleString()}`}
        </p>
      )}

      {mensaje && <Alerta tono="exito" titulo={mensaje} />}

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && !hayProductos && <EstadoVacio titulo="No hubo ventas en esta fecha." />}

      {!cargando && !error && hayProductos && (
        <Tabla etiqueta="Productos vendidos">
          <thead>
            <tr>
              <th>Producto</th>
              <th className="ui-num">Cantidad</th>
              <th className="ui-num">Monto (Bs.)</th>
            </tr>
          </thead>
          <tbody>
            {datos.productos.map((p) => (
              <tr key={p.sku}>
                <td>{p.descripcion || p.sku}</td>
                <td className="ui-num">{p.cantidad}</td>
                <td className="ui-num">{bs(p.monto)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total</th>
              <td className="ui-num">{totalUnidades}</td>
              <td className="ui-num">{bs(totalMonto)}</td>
            </tr>
          </tfoot>
        </Tabla>
      )}

      {confirmando && (
        <Modal
          abierto
          titulo="¿Enviar a Compras?"
          onCerrar={enviando ? undefined : () => setConfirmando(false)}
          acciones={
            <>
              <Boton variante="contorno" onClick={() => setConfirmando(false)} disabled={enviando}>
                Cancelar
              </Boton>
              <Boton onClick={confirmarEnvio} disabled={enviando}>
                {enviando ? 'Enviando...' : 'Sí, enviar'}
              </Boton>
            </>
          }
        >
          <div className="adm-form">
            <p>
              Se va a enviar el reporte de productos vendidos del {fecha} ({totalUnidades} unidades, Bs.{' '}
              {bs(totalMonto)}) a Compras.
            </p>
            {errorEnvio && <Alerta tono="error" titulo={errorEnvio} />}
          </div>
        </Modal>
      )}
    </section>
  )
}

export default ProductosVendidos
