import { useAuth } from '../context/AuthContext.jsx'
import TurnoModal from '../components/TurnoModal.jsx'
import './turno.css'

// TDSI-269: muestra el nombre del cajero autenticado en la pantalla principal.
function Home() {
  const { cajero } = useAuth()

  return (
    <section className="turno-inicio">
      <TurnoModal />
      <div className="turno-encabezado">
        <h1>Bienvenido, {cajero?.nombre}</h1>
        <p>
          Terminal {cajero?.caja}
          {cajero?.cajaNombre ? ` · ${cajero.cajaNombre}` : ''}
        </p>
      </div>
      <p>Panel principal del sistema. Elegí un módulo en el menú para empezar.</p>
    </section>
  )
}

export default Home
