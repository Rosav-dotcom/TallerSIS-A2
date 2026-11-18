import { useEffect, useState } from 'react'
import { obtenerRecaudadoPorCaja } from '../../api/caja.js'
import { Alerta, Boton, CampoTexto } from '../ui'

const METODOS = ['Efectivo', 'Tarjeta', 'QR']

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

// Ahora devuelve el string YYYY-MM-DD, no el ISO completo
function rangoDelDia(fecha) {
  return {
    desde: fecha,
    hasta: fecha, // El backend acepta un solo día como desde y hasta
  }
}

function PanelRecaudado() {
  const [fecha, setFecha] = useState(hoyLocal)
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    if (!fecha) return
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerRecaudadoPorCaja(rangoDelDia(fecha))
      .then((r) => vigente && setCajas(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, recargar])

  const hayMovimientos = cajas.some((c) => c.operaciones > 0)

  return (
    <section className="tab-panel">
      <div className="tab-cabecera">
        <div>
          <h2>Total recaudado por caja</h2>
          <p>
            Lo que recaudó cada caja activa en el día elegido: ingresos, egresos, neto y desglose por método de pago.
          </p>
        </div>
      </div>

      <div className="tab-filtros">
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          value={fecha}
          max={hoyLocal()}
          onChange={(e) => setFecha(e.target.value)}
        />
        {fecha !== hoyLocal() && (
          <Boton variante="contorno" onClick={() => setFecha(hoyLocal())}>
            Hoy
          </Boton>
        )}
      </div>

      {cargando && <p className="tab-nota">Cargando...</p>}

      {!cargando && error && (
        <div className="tab-filtros">
          <Alerta tono="error" titulo={`No se pudo obtener lo recaudado: ${error}`} />
          <Boton variante="contorno" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </Boton>
        </div>
      )}

      {!cargando && !error && cajas.length === 0 && <Alerta tono="info" titulo="No hay cajas activas registradas." />}

      {!cargando && !error && cajas.length > 0 && !hayMovimientos && (
        <Alerta tono="info" titulo="Sin movimientos: ninguna caja tuvo ingresos ni egresos en esta fecha." />
      )}

      {!cargando && !error && hayMovimientos && (
        <div className="tab-rejilla">
          {cajas.map((c) => (
            <article key={c.caja_id} className={`tab-ficha${c.operaciones > 0 ? '' : ' tab-ficha--inactiva'}`}>
              <div className="tab-ficha-cabecera">
                <span className="tab-ficha-codigo">{c.caja_id}</span>
                <span className="tab-detalle">{c.caja_nombre || 'Sin nombre'}</span>
              </div>

              <dl className="tab-datos">
                <div>
                  <dt>Ingresos</dt>
                  <dd>Bs. {c.totalIngresos.toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Egresos</dt>
                  <dd>Bs. {c.totalEgresos.toFixed(2)}</dd>
                </div>
                <div className="tab-datos-total">
                  <dt>Neto</dt>
                  <dd>Bs. {c.totalRecaudado.toFixed(2)}</dd>
                </div>
              </dl>

              {c.operaciones === 0 ? (
                <p className="tab-nota">Sin movimientos</p>
              ) : (
                <ul className="tab-datos">
                  {METODOS.map((m) => {
                    const metodo = c.porMetodo[m]
                    return (
                      <li key={m}>
                        <span>
                          {m}
                          <span className="tab-detalle">
                            {metodo.operaciones === 1 ? '1 operación' : `${metodo.operaciones} operaciones`}
                          </span>
                        </span>
                        <span className="tab-num">Bs. {metodo.neto.toFixed(2)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default PanelRecaudado
