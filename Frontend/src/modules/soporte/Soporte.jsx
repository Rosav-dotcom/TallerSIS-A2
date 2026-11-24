import RutaPorRol from '../../components/RutaPorRol.jsx'
import BuscarFacturaOPago from './BuscarFacturaOPago.jsx'

// Inicio del Usuario de Soporte (/soporte).
function Soporte() {
  return (
    <RutaPorRol roles={['USUARIO_SOPORTE']}>
      <BuscarFacturaOPago />
    </RutaPorRol>
  )
}

export default Soporte
