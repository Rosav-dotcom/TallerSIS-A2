import { Navigate, Route } from 'react-router-dom'
import GuardiaRol from './GuardiaRol.jsx'
import { BandejaIncidentes, Soporte, SOPORTE_ACTIVO } from '../modules/soporte'

// TDSI-666: rutas del Equipo 2. Todo lo que cuelga de /soporte pasa por un solo guardia:
// sin sesión va al login y con otro rol va al inicio de su perfil (Cajero → /,
// Administrador → /admin/tablero). Las pantallas nuevas de Soporte se agregan como hijas
// de este grupo y quedan protegidas sin repetir RutaPorRol en cada una.
const ROLES_SOPORTE = ['USUARIO_SOPORTE']

// Se llama como función dentro de <Routes> ({rutasEquipo2()}), porque <Routes> solo acepta <Route>.
// Con el interruptor "soporte" apagado no se registra ninguna ruta de Soporte.
export function rutasEquipo2() {
  if (!SOPORTE_ACTIVO) return null
  return (
    <Route path="/soporte" element={<GuardiaRol roles={ROLES_SOPORTE} />}>
      <Route index element={<Soporte />} />
      <Route path="incidentes" element={<BandejaIncidentes />} />
      {/* Una dirección de Soporte que no existe vuelve al inicio de Soporte (el guardia ya se aplicó). */}
      <Route path="*" element={<Navigate to="/soporte" replace />} />
    </Route>
  )
}
