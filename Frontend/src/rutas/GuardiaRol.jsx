import { Outlet } from 'react-router-dom'
import RutaPorRol from '../components/RutaPorRol.jsx'

// Guardia de un grupo de rutas: aplica RutaPorRol una sola vez y muestra la ruta hija que toque.
// Uso: <Route path="/soporte" element={<GuardiaRol roles={['USUARIO_SOPORTE']} />}>…</Route>
function GuardiaRol({ roles }) {
  return (
    <RutaPorRol roles={roles}>
      <Outlet />
    </RutaPorRol>
  )
}

export default GuardiaRol
