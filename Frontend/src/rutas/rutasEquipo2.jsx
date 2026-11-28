import { Navigate, Route } from 'react-router-dom'
import GuardiaRol from './GuardiaRol.jsx'
import {
  BandejaIncidentes,
  DETALLE_ACTIVO,
  DetalleIncidenteAdmin,
  HistorialUsuario,
  IncidentesEscalados,
  ReportesIncidencias,
  Soporte,
  SOPORTE_ACTIVO,
  SoporteIncidente,
} from '../modules/soporte'
import { COMPROBANTE_ACTIVO, ComprobanteReembolso } from '../modules/pagos'
import { KPIS_ACTIVO, TableroKpis } from '../modules/kpis'

// TDSI-666: rutas del Equipo 2. Todo lo que cuelga de /soporte pasa por un solo guardia:
// sin sesión va al login y con otro rol va al inicio de su perfil (Cajero → /,
// Administrador → /admin/tablero). Las pantallas nuevas de Soporte se agregan como hijas
// de este grupo y quedan protegidas sin repetir RutaPorRol en cada una.
const ROLES_SOPORTE = ['USUARIO_SOPORTE']
// TDSI-1073: la bandeja de incidentes escalados es solo del Administrador.
const ROLES_ADMIN = ['ADMINISTRADOR']
// TDSI-236: el comprobante de reembolso lo abre el Encargado de Devoluciones.
const ROLES_DEVOLUCIONES = ['ENCARGADO_DEVOLUCIONES']

// Se llama como función dentro de <Routes> ({rutasEquipo2()}), porque <Routes> solo acepta <Route>.
// Cada grupo se registra solo con su interruptor encendido.
export function rutasEquipo2() {
  return (
    <>
      {rutasSoporte()}
      {COMPROBANTE_ACTIVO && (
        <Route path="/devoluciones/:codigo/comprobante" element={<GuardiaRol roles={ROLES_DEVOLUCIONES} />}>
          <Route index element={<ComprobanteReembolso />} />
        </Route>
      )}
      {/* TDSI-640: Tablero de KPIs del Administrador (Inicio > "Tablero de KPIs") */}
      {KPIS_ACTIVO && (
        <Route path="/admin/kpis" element={<GuardiaRol roles={ROLES_ADMIN} />}>
          <Route index element={<TableroKpis />} />
        </Route>
      )}
    </>
  )
}

// Con el interruptor "soporte" apagado no se registra ninguna ruta de Soporte.
function rutasSoporte() {
  if (!SOPORTE_ACTIVO) return null
  return (
    <>
      <Route path="/soporte" element={<GuardiaRol roles={ROLES_SOPORTE} />}>
        <Route index element={<Soporte />} />
        <Route path="incidentes" element={<BandejaIncidentes />} />
        {DETALLE_ACTIVO && <Route path="incidentes/:numero" element={<SoporteIncidente />} />}
        <Route path="historial" element={<HistorialUsuario />} />
        <Route path="reportes" element={<ReportesIncidencias />} />
        {/* Una dirección de Soporte que no existe vuelve al inicio de Soporte (el guardia ya se aplicó). */}
        <Route path="*" element={<Navigate to="/soporte" replace />} />
      </Route>

      <Route path="/admin/soporte" element={<GuardiaRol roles={ROLES_ADMIN} />}>
        <Route path="escalados" element={<IncidentesEscalados />} />
        {DETALLE_ACTIVO && <Route path="incidentes/:numero" element={<DetalleIncidenteAdmin />} />}
      </Route>
    </>
  )
}
