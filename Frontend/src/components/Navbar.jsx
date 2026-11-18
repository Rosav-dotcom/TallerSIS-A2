import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useBloqueo } from '../context/BloqueoContext.jsx'
import { ChevronDown, Lock } from 'lucide-react'
import { Boton, Icono } from './ui'
import './navegacion.css'

// "Cerrar sesión" y "Cerrar caja" son 2 acciones distintas: cerrar sesión solo
// vuelve al login (el turno sigue activo, se puede volver a entrar); cerrar caja
// termina el turno con un reporte de lo recaudado. Van juntas en un solo menú
// desplegable para que no se confundan con un link de navegación más.
function Navbar() {
  const { cajero, cerrarSesion } = useAuth()
  const { bloquear } = useBloqueo()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function alHacerClicFuera(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAbierto(false)
      }
    }
    document.addEventListener('mousedown', alHacerClicFuera)
    return () => document.removeEventListener('mousedown', alHacerClicFuera)
  }, [])

  function handleCerrarSesion() {
    setMenuAbierto(false)
    cerrarSesion()
    navigate('/login')
  }

  function handleCerrarCaja() {
    setMenuAbierto(false)
    navigate('/cierre-caja')
  }

  return (
    <nav className="nav-cajero" aria-label="Menú del cajero">
      <span className="nav-cajero-marca">
        <span className="nav-logo">
          R<span className="nav-logo-punto">e</span>Pay
        </span>
      </span>
      {cajero && (
        <div className="nav-cajero-pestanas">
          <NavLink to="/" end>
            Inicio
          </NavLink>
          <NavLink to="/pagos">Cobrar</NavLink>
          <NavLink to="/facturas">Facturas</NavLink>
        </div>
      )}

      <div className="nav-cajero-derecha">
        {cajero && (
          <span className="nav-caja">
            <span className="nav-caja-nombre">{cajero.cajaNombre || cajero.caja}</span>
            <span className="nav-caja-codigo">{cajero.caja}</span>
          </span>
        )}
        {cajero ? (
          <div className="nav-usuario" ref={menuRef}>
            <button
              type="button"
              className="nav-usuario-boton"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-haspopup="menu"
            >
              <span className="nav-avatar" aria-hidden="true">
                {String(cajero.nombre || '?').charAt(0)}
              </span>
              <span className="nav-usuario-texto">
                <span className="nav-usuario-nombre">{cajero.nombre}</span>
                <span className="nav-usuario-rol">Cajero</span>
              </span>
              <Icono icono={ChevronDown} tamano={16} />
            </button>

            {menuAbierto && (
              <div className="nav-usuario-lista" role="menu">
                <button type="button" role="menuitem" className="nav-usuario-opcion" onClick={handleCerrarCaja}>
                  Cerrar caja
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="nav-usuario-opcion nav-usuario-opcion--peligro"
                  onClick={handleCerrarSesion}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="nav-sin-sesion">Sin sesión iniciada</span>
        )}
        {cajero && (
          // TDSI-855: bloquear la terminal al alejarse, sin cerrar sesión ni el turno.
          <Boton variante="contorno" icono={Lock} onClick={bloquear}>
            Bloquear
          </Boton>
        )}
      </div>
    </nav>
  )
}

export default Navbar
