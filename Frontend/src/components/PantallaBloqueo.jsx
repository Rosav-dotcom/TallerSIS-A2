import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { desbloquearPantalla } from '../api/auth.js'
import CampoPassword from './CampoPassword.jsx'
import { Alerta, Boton } from './ui'
import './navegacion.css'
import '../pages/acceso.css'
import './PantallaBloqueo.css'

const MAXIMO_INTENTOS = 3

// 404: no hay sesión activa para este cajero (p.ej. la cerró otra pestaña).
// 401 + este mensaje: ya se había cerrado por demasiados intentos fallidos.
const SESION_TERMINADA = /sesi[oó]n cerrada|inicie sesi[oó]n|no hay sesi[oó]n activa/i

// TDSI-856: pantalla de bloqueo con el nombre del cajero y su caja.
// TDSI-858: mensajes de contraseña incorrecta y cierre de sesión al tercer intento fallido.
function PantallaBloqueo({ intentos, onIntentoFallido, onDesbloqueada }) {
  const { cajero, cerrarSesion } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  function terminarSesion(mensaje) {
    cerrarSesion()
    navigate('/login', { replace: true, state: { mensaje } })
  }

  async function desbloquear(event) {
    event.preventDefault()
    if (!password) {
      setError('Escriba su contraseña.')
      return
    }

    setEnviando(true)
    setError(null)
    try {
      await desbloquearPantalla({ cajero_id: cajero.cajero_id, email: cajero.nombre, password })
      onDesbloqueada()
    } catch (err) {
      setPassword('')
      setEnviando(false)
      // Sin conexion no se cuenta como intento: no se llego a revisar la contraseña.
      if (err instanceof TypeError) {
        setError('No se pudo conectar con el servidor. Intente de nuevo.')
        return
      }
      if (err.status === 404 || SESION_TERMINADA.test(err.message)) {
        terminarSesion('Demasiados intentos fallidos. Inicie sesión nuevamente.')
        return
      }
      const fallidos = intentos + 1
      if (fallidos >= MAXIMO_INTENTOS) {
        terminarSesion('Demasiados intentos fallidos. Inicie sesión nuevamente.')
        return
      }
      onIntentoFallido(fallidos)
      const restantes = MAXIMO_INTENTOS - fallidos
      setError(`${err.message} ${restantes === 1 ? 'Le queda 1 intento.' : `Le quedan ${restantes} intentos.`}`)
    }
  }

  return (
    <div className="bloqueo" role="dialog" aria-modal="true" aria-labelledby="titulo-bloqueo">
      <form className="ui-tarjeta bloqueo-tarjeta" onSubmit={desbloquear}>
        <div className="bloqueo-usuario">
          <span className="nav-avatar" aria-hidden="true">
            {String(cajero.nombre || '?').charAt(0)}
          </span>
          <span className="nav-usuario-texto">
            <span className="nav-usuario-nombre">{cajero.nombre}</span>
            <span className="nav-usuario-rol">
              Cajero · {cajero.cajaNombre ? `${cajero.caja} · ${cajero.cajaNombre}` : cajero.caja}
            </span>
          </span>
        </div>
        <h2 id="titulo-bloqueo" className="bloqueo-titulo">
          Pantalla bloqueada
        </h2>
        <p className="bloqueo-ayuda">El turno sigue abierto. Escriba su contraseña para volver.</p>

        <label className="ui-campo">
          <span className="ui-campo-etiqueta">Contraseña</span>
          <span className="ui-control">
            <CampoPassword
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
            />
          </span>
        </label>

        {error && <Alerta tono="error" titulo={error} />}

        <Boton type="submit" ancho disabled={enviando}>
          {enviando ? 'Verificando...' : 'Desbloquear'}
        </Boton>
        <p className="bloqueo-nota">Tus operaciones permanecen protegidas.</p>
      </form>
    </div>
  )
}

export default PantallaBloqueo
