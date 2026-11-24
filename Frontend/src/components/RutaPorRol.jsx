import { Navigate } from 'react-router-dom'
import { useRolActual } from '../hooks/useRolActual.js'

const INICIO_POR_ROL = {
  CAJERO: '/',
  ADMINISTRADOR: '/admin/tablero',
  ENCARGADO_DEVOLUCIONES: '/devoluciones/nueva',
  USUARIO_SOPORTE: '/soporte',
}

// Protege una ruta por rol. Sin sesión, va al login; con un rol no permitido, va al inicio de su perfil.
// Uso: <RutaPorRol roles={['ENCARGADO_DEVOLUCIONES']}><NuevaDevolucion /></RutaPorRol>
function RutaPorRol({ roles, children }) {
  const rol = useRolActual()
  if (!rol) return <Navigate to="/login" replace />
  if (!roles.includes(rol)) return <Navigate to={INICIO_POR_ROL[rol] || '/login'} replace />
  return children
}

export default RutaPorRol
