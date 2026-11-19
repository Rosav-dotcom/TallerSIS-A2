import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronDown, ChevronUp, FileText, House, LifeBuoy, LogOut, Users, Wallet } from 'lucide-react'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { FEATURES } from '../config/features.js'
import { Boton, Icono } from './ui'
import './navegacion.css'

// Menú del Administrador en barra lateral (Figma p.8): las 14 pantallas agrupadas en
// secciones que se abren o cierran por separado. "Tablero de KPIs" e "Incidentes
// escalados" (Sprint 4) aparecen solo cuando se enciende su interruptor en config/features.js.
const GRUPOS = [
  {
    id: 'inicio',
    etiqueta: 'Inicio',
    icono: House,
    items: [
      { to: '/admin/tablero', etiqueta: 'Tablero de ingresos' },
      { to: '/admin/kpis', etiqueta: 'Tablero de KPIs', visible: FEATURES.tableroKpis },
    ],
  },
  {
    id: 'operacion',
    etiqueta: 'Operación',
    icono: Wallet,
    items: [
      { to: '/admin/cierre-diario', etiqueta: 'Cierre diario' },
      { to: '/admin/historial-operaciones', etiqueta: 'Historial de operaciones' },
      { to: '/admin/diferencias', etiqueta: 'Diferencias de caja' },
    ],
  },
  {
    id: 'analisis',
    etiqueta: 'Análisis',
    icono: BarChart3,
    items: [
      { to: '/admin/comparativo-mensual', etiqueta: 'Comparativo mensual' },
      { to: '/admin/horas-pico', etiqueta: 'Horas pico' },
      { to: '/admin/metas-venta', etiqueta: 'Metas de venta' },
      { to: '/admin/productos-vendidos', etiqueta: 'Productos vendidos' },
      { to: '/admin/ventas-online', etiqueta: 'Ventas online' },
    ],
  },
  {
    id: 'facturacion',
    etiqueta: 'Facturación',
    icono: FileText,
    items: [{ to: '/admin/libro-ventas', etiqueta: 'Libro de Ventas' }],
  },
  {
    id: 'personas',
    etiqueta: 'Personas',
    icono: Users,
    items: [
      { to: '/admin/cajeros', etiqueta: 'Cajeros' },
      { to: '/admin/clientes', etiqueta: 'Clientes' },
      { to: '/admin/supervisores', etiqueta: 'Supervisores' },
      { to: '/admin/usuarios', etiqueta: 'Usuarios' },
    ],
  },
  {
    id: 'soporte',
    etiqueta: 'Soporte',
    icono: LifeBuoy,
    items: [{ to: '/admin/soporte/escalados', etiqueta: 'Incidentes escalados', visible: FEATURES.soporte }],
  },
]
  .map((g) => ({ ...g, items: g.items.filter((i) => i.visible !== false) }))
  .filter((g) => g.items.length > 0)

const FECHA = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })

function AdminNavbar() {
  const { administrador, cerrarSesion } = useAdminAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Cada sección se abre o cierra por separado; empieza abierta la que contiene la pantalla actual.
  const [abiertos, setAbiertos] = useState(() =>
    Object.fromEntries(GRUPOS.map((g) => [g.id, g.items.some((i) => pathname.startsWith(i.to))])),
  )

  function handleCerrarSesion() {
    cerrarSesion()
    navigate('/login')
  }

  return (
    <>
      <aside className="nav-lateral">
        <div className="nav-lateral-marca">
          <span className="nav-logo">
            R<span className="nav-logo-punto">e</span>Pay
          </span>
          <span className="nav-lateral-rol">Administrador</span>
        </div>
        <nav className="nav-lateral-menu" aria-label="Menú del administrador">
          {GRUPOS.map((g) => (
            <div key={g.id}>
              <button
                type="button"
                className="nav-grupo-boton"
                aria-expanded={abiertos[g.id]}
                onClick={() => setAbiertos((a) => ({ ...a, [g.id]: !a[g.id] }))}
              >
                <Icono icono={g.icono} />
                {g.etiqueta}
                <span className="nav-grupo-flecha">
                  <Icono icono={abiertos[g.id] ? ChevronUp : ChevronDown} tamano={16} />
                </span>
              </button>
              {abiertos[g.id] &&
                g.items.map((item) => (
                  <NavLink key={item.to} to={item.to} className="nav-subitem">
                    {item.etiqueta}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="nav-lateral-pie">RePay · Gestión financiera</div>
      </aside>

      <header className="nav-superior">
        <div className="nav-superior-titulo">
          <strong>Administración</strong>
          <span>{FECHA.format(new Date())}</span>
        </div>
        <div className="nav-superior-derecha">
          <span className="nav-usuario-texto">
            <span className="nav-usuario-nombre">{administrador?.nombre}</span>
            <span className="nav-usuario-rol">Administrador</span>
          </span>
          <Boton variante="fantasma" icono={LogOut} onClick={handleCerrarSesion}>
            Cerrar sesión
          </Boton>
        </div>
      </header>
    </>
  )
}

export default AdminNavbar
