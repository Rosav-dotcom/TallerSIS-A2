import { useParams } from 'react-router-dom'
import DetalleIncidente from './DetalleIncidente.jsx'

// TDSI-1073: detalle de un incidente tomado por el Administrador (/admin/soporte/incidentes/:numero).
// Es el mismo detalle de Soporte: el Administrador registra la solución y cambia el estado.
// La protección por rol está en src/rutas/rutasEquipo2.jsx.
function DetalleIncidenteAdmin() {
  const { numero } = useParams()
  return <DetalleIncidente key={numero} numero={numero} />
}

export default DetalleIncidenteAdmin
