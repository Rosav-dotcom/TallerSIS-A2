import { useParams } from 'react-router-dom'
import RutaPorRol from '../../components/RutaPorRol.jsx'
import DetalleIncidente from './DetalleIncidente.jsx'

// Detalle de un incidente (/soporte/incidentes/:numero).
function SoporteIncidente() {
  const { numero } = useParams()
  return (
    <RutaPorRol roles={['USUARIO_SOPORTE']}>
      <DetalleIncidente key={numero} numero={numero} />
    </RutaPorRol>
  )
}

export default SoporteIncidente
