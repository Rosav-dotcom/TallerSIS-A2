import { useEffect, useState } from 'react'
import { obtenerEstadoCajas } from '../../api/caja.js'
import { Alerta, Boton, Chip, Selector } from '../ui'

// TDSI-126: estado de cada caja (terminal).
// TDSI-495: una tarjeta por caja.
// TDSI-496: insignias de estado (Abierta/Cerrada y Activa/Inactiva) con colores.
// TDSI-497: filtros por estado operativo y por actividad.
// TDSI-498: mensajes de "sin cajas" y de error.
//
// Datos: GET /api/caja/estado (gestion_caja). Cada caja trae { codigo, nombre, estado, activa },
// donde estado es ABIERTA | CERRADA | INACTIVA. Se piden todas una sola vez y los filtros
// se aplican aqui, porque una caja inactiva tambien cuenta como cerrada para el filtro.

const OPCIONES_ESTADO = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'ABIERTA', etiqueta: 'Abiertas' },
  { valor: 'CERRADA', etiqueta: 'Cerradas' },
]

const OPCIONES_ACTIVIDAD = [
  { valor: '', etiqueta: 'Todas' },
  { valor: 'ACTIVA', etiqueta: 'Activas' },
  { valor: 'INACTIVA', etiqueta: 'Inactivas' },
]

function PanelCajas() {
  const [cajas, setCajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroActividad, setFiltroActividad] = useState('')
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    setCargando(true)
    setError(null)
    obtenerEstadoCajas()
      .then((r) => setCajas(r.data))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false))
  }, [recargar])

  const hayFiltros = filtroEstado || filtroActividad
  const cajasFiltradas = cajas.filter((c) => {
    const abierta = c.estado === 'ABIERTA'
    if (filtroEstado === 'ABIERTA' && !abierta) return false
    if (filtroEstado === 'CERRADA' && abierta) return false
    if (filtroActividad === 'ACTIVA' && !c.activa) return false
    if (filtroActividad === 'INACTIVA' && c.activa) return false
    return true
  })

  return (
    <section className="tab-panel">
      <div className="tab-cabecera">
        <div>
          <h2>Estado de cajas</h2>
          <p>Cajas registradas en la sucursal: si tienen un turno abierto ahora mismo y si están habilitadas.</p>
        </div>
      </div>

      <div className="tab-filtros">
        <Selector etiqueta="Estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          {OPCIONES_ESTADO.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Actividad" value={filtroActividad} onChange={(e) => setFiltroActividad(e.target.value)}>
          {OPCIONES_ACTIVIDAD.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
        {hayFiltros && (
          <Boton
            variante="contorno"
            onClick={() => {
              setFiltroEstado('')
              setFiltroActividad('')
            }}
          >
            Quitar filtros
          </Boton>
        )}
      </div>

      {cargando && <p className="tab-nota">Cargando...</p>}

      {!cargando && error && (
        <div className="tab-filtros">
          <Alerta tono="error" titulo={`No se pudo obtener el estado de las cajas: ${error}`} />
          <Boton variante="contorno" onClick={() => setRecargar((n) => n + 1)}>
            Reintentar
          </Boton>
        </div>
      )}

      {!cargando && !error && cajasFiltradas.length === 0 && (
        <Alerta
          tono="info"
          titulo={
            hayFiltros
              ? 'Sin cajas: ninguna caja coincide con los filtros seleccionados.'
              : 'Todavía no hay cajas registradas en el sistema.'
          }
        />
      )}

      {!cargando && !error && cajasFiltradas.length > 0 && (
        <div className="tab-rejilla">
          {cajasFiltradas.map((c) => {
            const abierta = c.estado === 'ABIERTA'
            const activa = c.activa
            return (
              <article key={c.codigo} className={`tab-ficha${activa ? '' : ' tab-ficha--inactiva'}`}>
                <div className="tab-ficha-cabecera">
                  <span className="tab-ficha-codigo">{c.codigo}</span>
                  <span className="tab-detalle">{c.nombre || 'Sin nombre'}</span>
                </div>

                <div className="tab-ficha-chips">
                  <Chip tono={abierta ? 'exito' : 'neutro'}>{abierta ? 'Abierta' : 'Cerrada'}</Chip>
                  <Chip tono={activa ? 'info' : 'error'}>{activa ? 'Activa' : 'Inactiva'}</Chip>
                </div>

                <p className="tab-nota">
                  {!activa
                    ? 'Caja deshabilitada, no se pueden abrir turnos'
                    : abierta
                      ? 'Con turno vigente'
                      : 'Sin turno vigente'}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default PanelCajas
