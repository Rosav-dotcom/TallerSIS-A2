import { useState } from 'react'
import { Pestanas } from '../../components/ui'
import SeccionVentas from './SeccionVentas.jsx'
import './kpis.css'

const MES = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric', timeZone: 'America/La_Paz' })

// Pestañas del tablero. Cada equipo agrega la suya aquí (tablero-kpis.md): "Caja" y
// "Devoluciones y soporte" las suma TDSI-645 (Equipo 1) con SeccionCaja y SeccionDevolucionesSoporte.
const PESTANAS = [{ valor: 'ventas', texto: 'Ventas', Seccion: SeccionVentas }]

// Filtros comunes de las 3 pestañas. Vacíos = el mes en curso y todas las cajas y cajeros (lo
// resuelve el backend). La barra para cambiarlos (Periodo, Caja y Cajero) la agrega TDSI-1131;
// cada pestaña ya se vuelve a pedir cuando cambian.
const SIN_FILTROS = { desde: '', hasta: '', caja_id: '', cajero_id: '' }

// TDSI-640: "Tablero de KPIs" del Administrador (/admin/kpis). Cada pestaña pide sus datos solo cuando se abre.
function TableroKpis() {
  const [activa, setActiva] = useState(PESTANAS[0].valor)
  // TDSI-1131 agrega el setter (const [filtros, setFiltros]) junto con la barra de filtros.
  const [filtros] = useState(SIN_FILTROS)
  const { Seccion } = PESTANAS.find((p) => p.valor === activa)

  return (
    <section className="kpi-pagina">
      <header className="kpi-encabezado">
        <h1>Tablero de KPIs</h1>
        <p>
          {filtros.desde && filtros.hasta
            ? `Del ${filtros.desde} al ${filtros.hasta}`
            : `Mes en curso (${MES.format(new Date())})`}{' '}
          · {filtros.caja_id ? `Caja ${filtros.caja_id}` : 'Todas las cajas'}
        </p>
      </header>
      <Pestanas etiqueta="Tablero de KPIs" opciones={PESTANAS} activa={activa} onCambiar={setActiva} />
      <Seccion filtros={filtros} />
    </section>
  )
}

export default TableroKpis
