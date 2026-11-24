import { NavLink, useNavigate } from 'react-router-dom'
import { FilePlus2, FileText, Gift, BarChart3, Search, Headset, History, LogOut } from 'lucide-react'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { useRolActual } from '../../hooks/useRolActual.js'
import { Boton, Icono } from '../../components/ui'
import './devoluciones.css'

const OPCIONES = {
  ENCARGADO_DEVOLUCIONES: [
    { nombre: 'Nueva devolución', ruta: '/devoluciones/nueva', icono: FilePlus2, disponible: true },
    { nombre: 'Devoluciones', icono: FileText },
    { nombre: 'Vales de compra', icono: Gift },
    { nombre: 'Reportes', icono: BarChart3 },
  ],
  USUARIO_SOPORTE: [
    { nombre: 'Buscar factura o pago', icono: Search },
    { nombre: 'Incidentes', icono: Headset },
    { nombre: 'Historial por usuario', icono: History },
    { nombre: 'Reportes', icono: BarChart3 },
  ],
}

export default function MenuRol() {
  const rol = useRolActual()
  const { administrador, cerrarSesion } = useAdminAuth()
  const navigate = useNavigate()
  const esEncargado = rol === 'ENCARGADO_DEVOLUCIONES'
  const items = OPCIONES[rol] || []
  return (
    <>
      <aside className="nav-lateral">
        <div className="nav-lateral-marca">
          <span className="nav-logo">R<span className="nav-logo-punto">e</span>Pay</span>
          <span className="nav-lateral-rol">{esEncargado ? 'Encargado de Devoluciones' : 'Usuario de Soporte'}</span>
        </div>
        <nav className="nav-lateral-menu" aria-label="Menú del perfil">
          {items.map(({ nombre, ruta, icono, disponible }) => disponible ? (
            <NavLink to={ruta} className="nav-subitem" key={nombre}><Icono icono={icono} /> {nombre}</NavLink>
          ) : (
            <span key={nombre} className="nav-subitem dev-menu-pendiente" title="Disponible en una próxima historia" aria-disabled="true">
              <Icono icono={icono} /> {nombre}
            </span>
          ))}
        </nav>
        <div className="nav-lateral-pie">Sucursal La Paz · Central<br />RePay · Gestión financiera</div>
      </aside>
      <header className="nav-superior">
        <div className="nav-superior-titulo"><strong>{esEncargado ? 'Devoluciones y vales' : 'Soporte de operaciones'}</strong><span>RePay · Gestión financiera</span></div>
        <div className="nav-superior-derecha">
          <span className="nav-usuario-texto"><span className="nav-usuario-nombre">{administrador?.nombre}</span><span className="nav-usuario-rol">{administrador?.rol_nombre || rol}</span></span>
          <Boton variante="fantasma" icono={LogOut} onClick={() => { cerrarSesion(); navigate('/login') }}>Cerrar sesión</Boton>
        </div>
      </header>
    </>
  )
}
