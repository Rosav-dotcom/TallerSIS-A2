import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginCajero } from '../api/auth.js'
import { loginAdministrador } from '../api/authAdministrador.js'
import { listarCajas } from '../api/caja.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { ChevronDown } from 'lucide-react'
import fotoSupermercado from '../assets/login-supermercado.webp'
import { Alerta, Boton, Icono } from '../components/ui'
import '../components/navegacion.css'
import './acceso.css'

const ESTADO_INICIAL = {
  email: '',
  password: '',
  caja_id: '',
}

function validarCampos({ email, password, caja_id }, modo) {
  if (!email || !password || (modo === 'CAJERO' && !caja_id)) {
    return modo === 'CAJERO'
      ? 'Complete el usuario, la contraseña y la caja.'
      : 'Complete el usuario y la contraseña.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Ingrese un correo válido.'
  }
  if (password.length < 4) {
    return 'La contraseña debe tener al menos 4 caracteres.'
  }
  return null
}

// Perfil de acceso: Cajero o Administrador (Figma p.6 y p.11). Cada pestaña elige su perfil.
// Los perfiles del Sprint 4 (Encargado de Devoluciones y Usuario de Soporte) se agregan en TDSI-993.
const PERFILES = [
  { modo: 'CAJERO', texto: 'Cajero' },
  { modo: 'ADMINISTRADOR', texto: 'Administrador' },
  { modo: 'ENCARGADO_DEVOLUCIONES', texto: 'Encargado de Devoluciones' },
  { modo: 'USUARIO_SOPORTE', texto: 'Usuario de Soporte' },
]

function SelectorModo({ modo, onCambiar }) {
  return (
    <div className="acceso-perfiles">
      <span className="ui-campo-etiqueta" id="perfil-acceso">
        PERFIL DE ACCESO
      </span>
      <div className="acceso-perfiles-lista" role="radiogroup" aria-labelledby="perfil-acceso">
        {PERFILES.map((p) => (
          <button
            key={p.modo}
            type="button"
            role="radio"
            aria-checked={modo === p.modo}
            className={`acceso-perfil${modo === p.modo ? ' acceso-perfil--activo' : ''}`}
            onClick={() => onCambiar(p.modo)}
          >
            {p.texto}
          </button>
        ))}
      </div>
    </div>
  )
}

// TDSI-84: pantalla de inicio de sesión, tanto para el terminal POS (cajero) como para el panel de administración.
function Login() {
  const [modo, setModo] = useState('CAJERO') // 'CAJERO' | 'ADMINISTRADOR'
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [cajas, setCajas] = useState([])
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const { iniciarSesion: iniciarSesionCajero } = useAuth()
  const { iniciarSesion: iniciarSesionAdmin } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  // Lista desplegable de cajas activas, en vez de escribir el código a mano.
  useEffect(() => {
    listarCajas()
      .then((respuesta) => setCajas(respuesta.data))
      .catch(() => setCajas([]))
  }, [])

  // Seguridad: por más que autoComplete="off" esté puesto, Chrome y otros
  // navegadores igual autocompletan usuario/contraseña guardados en el login,
  // a veces recien despues de pintar la pantalla. Se limpian a la fuerza (estado
  // + el valor real del input) al entrar y un instante despues, para que la cuenta
  // de otra persona nunca quede visible al volver/recargar esta pantalla.
  useEffect(() => {
    function limpiar() {
      setDatos((prev) => ({ ...prev, email: '', password: '' }))
      if (emailRef.current) emailRef.current.value = ''
      if (passwordRef.current) passwordRef.current.value = ''
    }
    limpiar()
    const timeout = setTimeout(limpiar, 250)
    return () => clearTimeout(timeout)
  }, [])

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo)
    setErrorValidacion(null)
    setErrorApi(null)
  }

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const mensajeValidacion = validarCampos(datos, modo)
    if (mensajeValidacion) {
      setErrorValidacion(mensajeValidacion)
      setErrorApi(null)
      return
    }
    setErrorValidacion(null)
    setErrorApi(null)
    setEnviando(true)

    try {
      if (modo === 'CAJERO') {
        const respuesta = await loginCajero(datos)
        iniciarSesionCajero({
          nombre: respuesta.data.cajero.email,
          cajero_id: respuesta.data.cajero.cajero_id, // TDSI-53: lo pide el desbloqueo de pantalla
          caja: respuesta.data.caja.codigo,
          cajaNombre: respuesta.data.caja.nombre,
        })
        // Al llegar a Inicio, el TurnoModal avisa si la caja esta activa o
        // inactiva, y exige abrir el turno con un supervisor si hace falta.
        navigate('/')
      } else {
        const respuesta = await loginAdministrador({ ...datos, rol: modo })
        iniciarSesionAdmin(respuesta.data.administrador)
        navigate(modo === 'ENCARGADO_DEVOLUCIONES' ? '/devoluciones/nueva' : modo === 'USUARIO_SOPORTE' ? '/soporte' : '/admin/tablero')
      }
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const esAdmin = modo !== 'CAJERO'

  return (
    <div className="acceso">
      <aside className="acceso-hero">
        <span className="nav-logo">
          R<span className="nav-logo-punto">e</span>Pay
        </span>

        <div className="acceso-hero-centro">
          <span className="acceso-etiqueta">Gestión financiera</span>
          <span className="acceso-linea" aria-hidden="true" />
          <h1>
            Cobros y facturación
            <br />
            del supermercado
          </h1>
          <p className="acceso-lema">
            Cada movimiento en orden.
            <br />
            Cada jornada, con tranquilidad.
          </p>
          <p>Un espacio de trabajo para quienes gestionan el supermercado cada día.</p>
        </div>

        <img
          className="acceso-foto"
          src={fotoSupermercado}
          alt="Cajero atendiendo en una caja del supermercado con RePay"
          width="1026"
          height="598"
        />

        <div className="acceso-hero-pie">
          <strong>RePay / Bolivia</strong>
          <span>Acceso seguro al ERP del supermercado</span>
        </div>
      </aside>

      <div className="acceso-panel">
        <div className="acceso-contenido">
          <div className="acceso-encabezado">
            <h2 className="acceso-titulo">Hola de nuevo.</h2>
            <p className="acceso-subtitulo">Ingresa con la cuenta que te asignó el supermercado.</p>
          </div>

          <SelectorModo modo={modo} onCambiar={cambiarModo} />

          <form className="acceso-form" onSubmit={handleSubmit} autoComplete="off">
            <label className="ui-campo">
              <span className="ui-campo-etiqueta">Correo electrónico</span>
              <span className="ui-control">
                <input
                  ref={emailRef}
                  type="email"
                  autoComplete="off"
                  placeholder="tu.correo@empresa.bo"
                  value={datos.email}
                  onChange={(e) => actualizarCampo('email', e.target.value)}
                />
              </span>
            </label>

            <label className="ui-campo">
              <span className="ui-campo-etiqueta">Contraseña</span>
              <span className="ui-control">
                <input
                  ref={passwordRef}
                  type={mostrarPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={datos.password}
                  onChange={(e) => actualizarCampo('password', e.target.value)}
                />
                <button
                  type="button"
                  className="acceso-mostrar"
                  onClick={() => setMostrarPassword((v) => !v)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {mostrarPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
            </label>

            {!esAdmin ? (
              <label className="ui-campo">
                <span className="ui-campo-etiqueta">Caja</span>
                <span className="ui-control">
                  <select value={datos.caja_id} onChange={(e) => actualizarCampo('caja_id', e.target.value)}>
                    <option value="" disabled>
                      Selecciona una caja...
                    </option>
                    {cajas.map((caja) => (
                      <option key={caja.codigo} value={caja.codigo}>
                        {caja.codigo} — {caja.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="ui-control-icono">
                    <Icono icono={ChevronDown} />
                  </span>
                </span>
                <span className="ui-campo-ayuda">La caja seleccionada se asignará a tu turno al ingresar.</span>
              </label>
            ) : (
              <p className="acceso-ayuda">{modo === 'ENCARGADO_DEVOLUCIONES' ? 'Gestiona devoluciones y vales de compra.' : modo === 'USUARIO_SOPORTE' ? 'Resuelve incidentes y consulta operaciones.' : 'Acceso a la administración y al análisis de la operación.'} La selección de caja está disponible únicamente para Cajero.</p>
            )}

            {errorValidacion && <Alerta tono="error" titulo={errorValidacion} />}
            {errorApi && <Alerta tono="error" titulo={`Error: ${errorApi}`} />}
            {/* TDSI-858: aviso cuando la sesion se cerro por fallar el desbloqueo 3 veces */}
            {!errorApi && location.state?.mensaje && <Alerta tono="error" titulo={location.state.mensaje} />}

            <Boton type="submit" ancho disabled={enviando}>
              {enviando ? 'Ingresando...' : 'Ingresar'}
            </Boton>
          </form>

          <p className="acceso-ayuda">
            <strong>¿Olvidaste tu contraseña?</strong> Pídele al administrador que te asigne una nueva.
          </p>

          <p className="acceso-nota">
            {esAdmin
              ? 'Usa un equipo de confianza y cierra sesión al terminar. No compartas tu contraseña.'
              : 'Usa tu propia cuenta y cierra sesión al terminar el turno. Si la caja queda 5 minutos sin uso, la pantalla se bloquea sola.'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
