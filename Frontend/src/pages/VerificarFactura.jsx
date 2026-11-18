import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { verificarFactura } from '../api/facturaPublica.js'
import { Alerta, EstadoCargando, EstadoError, Tabla, Tarjeta } from '../components/ui'
import '../components/navegacion.css'
import './acceso.css'

// TDSI-38/551-554: pagina publica (sin login) a la que lleva el QR impreso en
// la factura. De solo lectura, pensada para abrirse desde el celular del cliente.
function VerificarFactura() {
  const { token } = useParams()
  const [factura, setFactura] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setCargando(true)
    verificarFactura(token)
      .then((r) => {
        setFactura(r.data)
        setError(null)
      })
      .catch((err) => {
        setFactura(null)
        setError(err.message)
      })
      .finally(() => setCargando(false))
  }, [token])

  return (
    <div className="verificar">
      <header className="verificar-cabecera">
        <span className="nav-logo">
          R<span className="nav-logo-punto">e</span>Pay
        </span>
      </header>

      <main className="verificar-contenido">
        <h1 className="verificar-titulo">Verificar factura</h1>

        {cargando && <EstadoCargando lineas={4} texto="Cargando..." />}

        {/* TDSI-554 */}
        {!cargando && error && (
          <Tarjeta>
            <EstadoError
              titulo="Factura no encontrada"
              texto="Este código QR no corresponde a ninguna factura válida, o ya no está disponible."
            />
          </Tarjeta>
        )}

        {!cargando && factura && (
          <>
            {factura.estado === 'Anulado' ? (
              <Alerta tono="error" titulo="ANULADA" />
            ) : (
              <Alerta tono="exito" titulo="Factura válida">
                Estado: {factura.estado}
              </Alerta>
            )}

            <Tarjeta titulo="Comprobante de pago">
              <dl className="verificar-datos">
                <dt>Número</dt>
                <dd>{factura.id_transaccion}</dd>

                <dt>Fecha</dt>
                <dd>{new Date(factura.fecha).toLocaleString()}</dd>

                <dt>Cliente</dt>
                <dd>
                  {factura.cliente}
                  {factura.nit ? ` (NIT/CI: ${factura.nit})` : ''}
                </dd>

                {/* TDSI-61/947: quien atendio la venta (nombre + caja, o "no registrado"). */}
                <dt>Atendido por</dt>
                <dd>{factura.atendido_por}</dd>
              </dl>
            </Tarjeta>

            <Tabla etiqueta="Métodos de pago">
              <thead>
                <tr>
                  <th>Método de pago</th>
                  <th className="ui-num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {factura.metodos.map((m) => (
                  <tr key={m.metodo}>
                    <td>{m.metodo}</td>
                    <td className="ui-num">Bs. {m.monto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>

            <Tarjeta>
              <span className="verificar-total-etiqueta">Total</span>
              <strong className="verificar-total">Bs. {factura.total.toFixed(2)}</strong>
            </Tarjeta>

            <p className="verificar-pie">Documento generado por el sistema RePay. Uso académico.</p>
          </>
        )}
      </main>
    </div>
  )
}

export default VerificarFactura
