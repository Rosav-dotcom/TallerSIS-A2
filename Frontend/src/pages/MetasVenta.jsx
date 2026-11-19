import { useEffect, useState } from 'react'
import { obtenerAvanceMetas, definirMeta } from '../api/metas.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { Alerta, Boton, CampoTexto, EstadoVacio, Modal } from '../components/ui'
import './turno.css'
import './admin.css'

function hoyLocal() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

const bs = (v) => Number(v ?? 0).toFixed(2)

// TDSI-58: la tarjeta muestra "Vendido hoy" solo si la fecha elegida es hoy; para
// cualquier otra fecha muestra el dia elegido, para no decir "hoy" de un dia pasado.
function etiquetaVendido(fecha) {
  if (fecha === hoyLocal()) return 'Vendido hoy'
  const [anio, mes, dia] = fecha.split('-')
  return `Vendido el ${dia}/${mes}/${anio}`
}

function colorAvance(porcentaje) {
  if (porcentaje >= 100) return 'var(--success)' // verde
  if (porcentaje >= 50) return 'var(--warning)' // amarillo/ambar
  return 'var(--error)' // rojo
}

// TDSI-194/777-780: pantalla "Metas de venta" del Administrador -- una tarjeta por
// caja con su meta diaria, lo vendido y una barra de avance.
function MetasVenta() {
  const { administrador } = useAdminAuth()

  const [fecha, setFecha] = useState(hoyLocal)
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)

  const [editando, setEditando] = useState(null) // { caja_id, caja_nombre, meta } | null
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorEditar, setErrorEditar] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerAvanceMetas(fecha)
      .then((r) => vigente && setCajas(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [fecha, recargar])

  function abrirEditar(caja) {
    setEditando(caja)
    setMonto(typeof caja.meta === 'number' ? String(caja.meta) : '')
    setErrorEditar(null)
  }

  async function confirmarEditar(event) {
    event.preventDefault()
    const montoNum = Number(monto)
    if (!monto || !(montoNum > 0)) {
      setErrorEditar('La meta debe ser un monto mayor a 0.')
      return
    }
    setGuardando(true)
    setErrorEditar(null)
    try {
      await definirMeta(editando.caja_id, { monto: montoNum, actualizado_por: administrador?.nombre })
      setEditando(null)
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEditar(err.mensaje || err.message)
    } finally {
      setGuardando(false)
    }
  }

  const montoValido = Number(monto) > 0

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Metas de venta</h1>
        <p>Meta de venta diaria de cada caja y el avance del día.</p>
      </div>

      <div className="adm-filtros">
        <CampoTexto
          etiqueta="Fecha"
          type="date"
          value={fecha}
          max={hoyLocal()}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && cajas.length === 0 && <EstadoVacio titulo="No hay cajas registradas." />}

      {!cargando && !error && cajas.length > 0 && (
        <div className="adm-rejilla">
          {cajas.map((c) => {
            const sinMeta = c.meta === 'sin meta'
            const porcentaje = sinMeta ? 0 : c.porcentaje
            return (
              <article key={c.caja_id} className="adm-ficha">
                <div>
                  <span className="adm-ficha-codigo">{c.caja_id}</span>
                  <span className="adm-detalle">{c.caja_nombre || 'Sin nombre'}</span>
                </div>

                <dl className="adm-datos">
                  <div>
                    <dt>{etiquetaVendido(fecha)}</dt>
                    <dd>Bs. {bs(c.vendido)}</dd>
                  </div>
                  <div>
                    <dt>Meta</dt>
                    <dd>{sinMeta ? 'Sin meta' : `Bs. ${bs(c.meta)}`}</dd>
                  </div>
                </dl>

                {!sinMeta && (
                  <div>
                    <div className="adm-avance" role="presentation">
                      <div
                        className="adm-avance-barra"
                        style={{ width: `${Math.min(porcentaje, 100)}%`, backgroundColor: colorAvance(porcentaje) }}
                      />
                    </div>
                    <strong className="adm-avance-porcentaje" style={{ color: colorAvance(porcentaje) }}>
                      {porcentaje.toFixed(1)}%
                    </strong>
                  </div>
                )}

                <div>
                  <Boton variante="contorno" onClick={() => abrirEditar(c)}>
                    {sinMeta ? 'Definir meta' : 'Editar meta'}
                  </Boton>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editando && (
        <Modal
          abierto
          titulo={editando.meta === 'sin meta' ? 'Definir meta' : 'Editar meta'}
          onCerrar={guardando ? undefined : () => setEditando(null)}
        >
          <form className="adm-form" onSubmit={confirmarEditar}>
            <p className="adm-nota">
              {editando.caja_id} {editando.caja_nombre ? `· ${editando.caja_nombre}` : ''}
            </p>

            <CampoTexto
              etiqueta="Meta de venta diaria"
              prefijo="Bs"
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => {
                setMonto(e.target.value)
                setErrorEditar(null)
              }}
              autoFocus
            />

            {errorEditar && <Alerta tono="error" titulo={errorEditar} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={() => setEditando(null)} disabled={guardando}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardando || !montoValido}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}

export default MetasVenta
