import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generarReporteCierre, cerrarTurno, urlReporteCierrePdf, obtenerAnuladasTurno } from '../api/caja.js'
import { obtenerTurnoActual } from '../api/turnos.js'
import { useAuth } from '../context/AuthContext.jsx'
import ArqueoEfectivo, { ResumenArqueo } from '../components/ArqueoEfectivo.jsx'
import CampoPassword from '../components/CampoPassword.jsx'
import { Check } from 'lucide-react'
import { Alerta, Boton, CampoTexto, EstadoCargando, Icono, Modal, Tabla, Tarjeta } from '../components/ui'
import './turno.css'
import { arqueoEsValido, arqueoTieneConteo, totalContadoCentavos, detalleArqueo } from '../utils/arqueo.js'

function CierreCaja() {
  const { cajero, cerrarSesion } = useAuth()
  const navigate = useNavigate()

  function volverAIniciarSesion() {
    cerrarSesion()
    navigate('/login')
  }

  const [turnoActual, setTurnoActual] = useState(null) 
  const [cargandoTurno, setCargandoTurno] = useState(true)
  const [errorTurno, setErrorTurno] = useState(null)

  const [paso, setPaso] = useState('ingreso')
  const [supervisorId, setSupervisorId] = useState('')
  const [pin, setPin] = useState('')
  const [cantidades, setCantidades] = useState({})
  
  const efectivoContado = totalContadoCentavos(cantidades) / 100
  const [reporte, setReporte] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // TDSI-49/176: ventana con el detalle de facturas anuladas del turno.
  const [mostrandoAnuladas, setMostrandoAnuladas] = useState(false)
  const [anuladas, setAnuladas] = useState(null)
  const [cargandoAnuladas, setCargandoAnuladas] = useState(false)
  const [errorAnuladas, setErrorAnuladas] = useState(null)

  // El turno (de caja) sale de la caja del cajero logueado, no se escribe a mano.
  useEffect(() => {
    if (!cajero?.caja) {
      setCargandoTurno(false)
      return
    }
    setCargandoTurno(true)
    obtenerTurnoActual(cajero.caja)
      .then((r) => setErrorTurno(null) || setTurnoActual(r.data))
      .catch((err) => setErrorTurno(err.message))
      .finally(() => setCargandoTurno(false))
  }, [cajero?.caja])

  const turnoId = turnoActual?.id
  const efectivoEsperado = reporte?.arqueoEfectivo?.efectivoEsperado ?? reporte?.totalesPorMetodo?.Efectivo?.neto ?? 0

  const manejarContinuar = async (e) => {
    e.preventDefault()
    if (!supervisorId.trim() || !pin.trim()) {
      setError('Ingrese el usuario y el PIN de un supervisor de caja para poder cerrar la caja.')
      return
    }
    if (!arqueoEsValido(cantidades) || !arqueoTieneConteo(cantidades)) {
      setError('Complete el arqueo de efectivo con números enteros para poder cerrar la caja.')
      return
    }

    setCargando(true)
    setError(null)
    try {
      const { data } = await generarReporteCierre(turnoId, Number(efectivoContado))
      setReporte(data)
      setPaso('reporte')
    } catch (err) {
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  const manejarCerrarCaja = async () => {
    setCargando(true)
    setError(null)
    try {
      const arqueo = detalleArqueo(cantidades)
      await cerrarTurno(turnoId, { supervisor_id: supervisorId.trim(), pin: pin.trim(), efectivo_contado: Number(efectivoContado), arqueo })
      
      window.open(urlReporteCierrePdf(turnoId, Number(efectivoContado)), '_blank', 'noopener,noreferrer')
      setPaso('listo')
    } catch (err) {
      setPaso('ingreso')
      setError(err.mensaje || err.message)
    } finally {
      setCargando(false)
    }
  }

  async function abrirAnuladas() {
    setMostrandoAnuladas(true)
    setCargandoAnuladas(true)
    setErrorAnuladas(null)
    try {
      const { data } = await obtenerAnuladasTurno(turnoId)
      setAnuladas(data)
    } catch (err) {
      setErrorAnuladas(err.mensaje || err.message)
    } finally {
      setCargandoAnuladas(false)
    }
  }

  function cerrarAnuladas() {
    setMostrandoAnuladas(false)
  }

  if (cargandoTurno) {
    return (
      <section>
        <div className="turno-encabezado">
          <h1>Cierre de caja</h1>
        </div>
        <Tarjeta>
          <EstadoCargando texto="Buscando el turno abierto de su caja..." />
          <p className="turno-arqueo-ayuda">Buscando el turno abierto de su caja...</p>
        </Tarjeta>
      </section>
    )
  }

  if (errorTurno || !turnoActual) {
    return (
      <section>
        <div className="turno-encabezado">
          <h1>Cierre de caja</h1>
        </div>
        <Alerta
          tono="error"
          titulo={errorTurno || 'No hay un turno abierto en su caja. Abra un turno antes de cerrar caja.'}
        />
      </section>
    )
  }

  const codigoTurno = turnoActual.codigo ?? turnoId

  return (
    <section>
      <div className={`turno-encabezado${paso === 'listo' ? ' turno-encabezado--exito' : ''}`}>
        <h1>
          {paso === 'listo' && <Icono icono={Check} tamano={28} />}
          {paso === 'listo' ? 'Caja cerrada exitosamente' : 'Cierre de caja'}
        </h1>
        <p>
          Turno {codigoTurno} · {cajero?.cajaNombre || cajero?.caja} · {cajero?.nombre}
        </p>
      </div>

      {error && (
        <div className="turno-columna turno-aviso">
          <Alerta tono="error" titulo={error} />
        </div>
      )}

      {paso === 'ingreso' && (
        <form className="turno-columnas" onSubmit={manejarContinuar}>
          <Tarjeta>
            <ArqueoEfectivo
              cantidades={cantidades}
              onChange={(nuevas) => {
                setCantidades(nuevas)
                setError(null)
              }}
              mostrarDiferencia={false}
            />
          </Tarjeta>

          <Tarjeta titulo="Autorización del supervisor">
            <div className="turno-columna">
              <p className="turno-arqueo-ayuda">
                Por favor, ingrese los datos del supervisor de caja para cerrar caja. Pida a un supervisor de caja su
                usuario y PIN para poder cerrar el turno.
              </p>
              <CampoTexto
                etiqueta="Usuario del supervisor"
                type="text"
                autoComplete="off"
                value={supervisorId}
                onChange={(e) => {
                  setSupervisorId(e.target.value)
                  setError(null)
                }}
              />

              <label className="ui-campo">
                <span className="ui-campo-etiqueta">PIN del supervisor</span>
                <span className="ui-control">
                  <CampoPassword
                    inputMode="numeric"
                    autoComplete="new-password"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value)
                      setError(null)
                    }}
                  />
                </span>
              </label>

              <Boton type="submit" ancho disabled={cargando}>
                {cargando ? 'Generando Reporte...' : 'Continuar al Reporte'}
              </Boton>
              <span className="ui-campo-ayuda">Esta autorización quedará registrada en la auditoría.</span>
            </div>
          </Tarjeta>
        </form>
      )}

      {paso === 'reporte' && reporte && (
        <div className="turno-columnas">
          <div className="turno-columna">
            <Tarjeta titulo={`Reporte de cierre de turno #${codigoTurno}`}>
              <Tabla etiqueta="Resumen medios de pago">
                <thead>
                  <tr>
                    <th>Método de pago</th>
                    <th className="ui-num">Operaciones</th>
                    <th className="ui-num">Neto cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reporte.totalesPorMetodo || {}).map(([metodo, totales]) => (
                    <tr key={metodo}>
                      <td>{metodo}</td>
                      <td className="ui-num">{totales.operaciones} op.</td>
                      <td className="ui-num">Bs. {totales.neto}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
              <div className="turno-total">
                <span>Total recaudado</span>
                <strong>Bs. {reporte.totalRecaudado}</strong>
              </div>
            </Tarjeta>

            <Tarjeta>
              <ResumenArqueo cantidades={cantidades} efectivoEsperado={efectivoEsperado} />
            </Tarjeta>
          </div>

          <Tarjeta titulo="Antes de cerrar">
            <div className="turno-columna">
              <dl className="turno-datos">
                <div>
                  <dt>Efectivo</dt>
                  <dd>Bs. {reporte.totalesPorMetodo?.Efectivo?.neto ?? 0}</dd>
                </div>
                <div>
                  <dt>Digital (Tarjeta + QR)</dt>
                  <dd>Bs. {reporte.resumenVentas?.totalDigital ?? 0}</dd>
                </div>
                <div>
                  <dt>Ventas</dt>
                  <dd>{reporte.resumenVentas?.cantidadVentas ?? 0}</dd>
                </div>
                <div>
                  <dt>Facturas anuladas</dt>
                  <dd>{reporte.resumenVentas?.cantidadAnuladas ?? 0}</dd>
                </div>
              </dl>
              {reporte.resumenVentas?.cantidadAnuladas > 0 && (
                <>
                  <Alerta tono="advertencia" titulo={`(Bs. ${reporte.resumenVentas.montoAnulado} anulados, no contados)`} />
                  <Boton variante="contorno" ancho onClick={abrirAnuladas}>
                    Ver anuladas
                  </Boton>
                </>
              )}
              <div className="turno-acciones">
                <Boton variante="contorno" onClick={() => setPaso('ingreso')} disabled={cargando}>
                  Volver
                </Boton>
                <Boton variante="peligro" onClick={manejarCerrarCaja} disabled={cargando}>
                  {cargando ? 'Cerrando Turno...' : 'Cerrar caja y continuar'}
                </Boton>
              </div>
            </div>
          </Tarjeta>
        </div>
      )}

      <Modal abierto={mostrandoAnuladas} titulo="Facturas anuladas del turno" onCerrar={cerrarAnuladas}>
        {cargandoAnuladas && <EstadoCargando texto="Cargando..." />}

        {!cargandoAnuladas && errorAnuladas && (
          <Alerta tono="error" titulo={`No se pudo cargar la lista de anuladas: ${errorAnuladas}`} />
        )}

        {!cargandoAnuladas && !errorAnuladas && anuladas && (
          <Tabla etiqueta="Facturas anuladas del turno">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>Hora</th>
                <th className="ui-num">Total (Bs.)</th>
                <th>Motivo</th>
                <th>Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {anuladas.anuladas.map((a) => (
                <tr key={a.numero_factura}>
                  <td>{a.numero_factura}</td>
                  <td>{new Date(a.hora).toLocaleTimeString()}</td>
                  <td className="ui-num">{a.total.toFixed(2)}</td>
                  <td>{a.motivo || '—'}</td>
                  <td>{a.supervisor || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <strong>Total anulado</strong>
                </td>
                <td className="ui-num">
                  <strong>{anuladas.montoAnulado.toFixed(2)}</strong>
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </Tabla>
        )}
      </Modal>

      {paso === 'listo' && (
        <div className="turno-columnas">
          <Tarjeta titulo="Arqueo revisado">
            <div className="turno-columna">
              <p className="turno-arqueo-ayuda">
                El turno #{codigoTurno} ha sido cerrado. El reporte en PDF se abrió en una pestaña nueva.
              </p>
              <ResumenArqueo cantidades={cantidades} efectivoEsperado={efectivoEsperado} />
            </div>
          </Tarjeta>
          <Tarjeta>
            <Boton ancho onClick={volverAIniciarSesion}>
              Volver al Inicio
            </Boton>
          </Tarjeta>
        </div>
      )}
    </section>
  )
}

export default CierreCaja
