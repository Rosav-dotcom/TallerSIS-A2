import { useAuth } from '../context/AuthContext.jsx'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

// Rol de la sesión actual. Los roles nuevos (ENCARGADO_DEVOLUCIONES, USUARIO_SOPORTE) los
// devuelve el login de administrador cuando el backend agregue el campo "rol" (TDSI-992);
// mientras no venga, una sesión de administrador cuenta como ADMINISTRADOR.
export function useRolActual() {
  const { cajero } = useAuth()
  const { administrador } = useAdminAuth()
  if (administrador) return administrador.rol || 'ADMINISTRADOR'
  if (cajero) return 'CAJERO'
  return null
}
