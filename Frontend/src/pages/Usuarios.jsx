import { useEffect, useState } from 'react'
import { listarUsuarios, crearCajero, crearPersonal, listarRolesPersonal, editarUsuario, cambiarPasswordCajero, cambiarEstadoUsuario } from '../api/usuarios.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import { Plus } from 'lucide-react'
import {
  Alerta,
  Boton,
  CampoContrasena,
  CampoTexto,
  Chip,
  EstadoVacio,
  Modal,
  Selector,
  Tabla,
} from '../components/ui'
import './turno.css'
import './admin.css'

const TONO_ESTADO = { Activo: 'exito', Inactivo: 'neutro', Bloqueado: 'error' }
const FILTROS_ROL = [
  { valor: '', etiqueta: 'Todos' },
  { valor: 'Cajero', etiqueta: 'Cajeros' },
  { valor: 'Supervisor', etiqueta: 'Supervisores' },
  { valor: 'Encargado de Devoluciones', etiqueta: 'Encargados de Devoluciones' },
  { valor: 'Usuario de Soporte', etiqueta: 'Usuarios de Soporte' },
]
const NUEVO_USUARIO_INICIAL = { usuario: '', nombre: '', password: '', confirmarPassword: '', rol: 'Cajero' }
const ROLES_PERSONAL_POR_DEFECTO = [
  { codigo: 'ENCARGADO_DEVOLUCIONES', nombre: 'Encargado de Devoluciones' },
  { codigo: 'USUARIO_SOPORTE', nombre: 'Usuario de Soporte' },
]

// TDSI-172/920-923: pantalla "Usuarios" del Administrador -- cajeros y supervisores
// en una sola lista, con alta de cajeros, edicion y activar/desactivar.
function Usuarios() {
  const { administrador } = useAdminAuth()
  const token = administrador?.access_token

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)
  const [filtroRol, setFiltroRol] = useState('')
  const [mensaje, setMensaje] = useState(null)

  const [mostrandoNuevo, setMostrandoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState(NUEVO_USUARIO_INICIAL)
  const [rolesPersonal, setRolesPersonal] = useState(ROLES_PERSONAL_POR_DEFECTO)
  const [creando, setCreando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState(null)

  const [editando, setEditando] = useState(null) // usuario seleccionado | null
  const [formEditar, setFormEditar] = useState({ usuario: '', nombre: '' })
  const [cambiarPassword, setCambiarPassword] = useState(false)
  const [passwordNueva, setPasswordNueva] = useState('')
  const [passwordConfirmar, setPasswordConfirmar] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [errorEditar, setErrorEditar] = useState(null)

  const [cambiandoEstadoDe, setCambiandoEstadoDe] = useState(null) // usuario | null
  const [guardandoEstado, setGuardandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState(null)

  useEffect(() => {
    if (!token) return
    let vigente = true
    setCargando(true)
    setError(null)
    listarUsuarios(token)
      .then((r) => vigente && setUsuarios(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [token, recargar])

  useEffect(() => {
    if (!token) return
    let vigente = true
    listarRolesPersonal(token)
      .then((r) => { if (vigente && Array.isArray(r.data)) setRolesPersonal(r.data) })
      .catch(() => { /* Mantiene los roles documentados si no se puede cargar el catálogo. */ })
    return () => { vigente = false }
  }, [token])

  const usuariosFiltrados = filtroRol ? usuarios.filter((u) => u.rol === filtroRol) : usuarios

  function abrirNuevo() {
    setNuevo(NUEVO_USUARIO_INICIAL)
    setErrorNuevo(null)
    setMostrandoNuevo(true)
    setMensaje(null)
  }

  async function confirmarNuevo(event) {
    event.preventDefault()
    if (!nuevo.usuario.trim() || !nuevo.nombre.trim()) {
      setErrorNuevo('Complete el usuario y el nombre.')
      return
    }
    if (nuevo.password.length < 6) {
      setErrorNuevo('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (nuevo.password !== nuevo.confirmarPassword) {
      setErrorNuevo('La contraseña y su confirmación no coinciden.')
      return
    }
    setCreando(true)
    setErrorNuevo(null)
    try {
      const datos = { usuario: nuevo.usuario.trim(), nombre: nuevo.nombre.trim(), password: nuevo.password }
      if (nuevo.rol === 'Cajero') {
        await crearCajero(datos, token)
      } else {
        await crearPersonal({ ...datos, rol: nuevo.rol }, token)
      }
      setMostrandoNuevo(false)
      setMensaje({ ok: true, texto: `Usuario "${nuevo.usuario.trim()}" registrado correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorNuevo(err.mensaje || err.message)
    } finally {
      setCreando(false)
    }
  }

  function abrirEditar(usuario) {
    setEditando(usuario)
    setFormEditar({ usuario: usuario.usuario, nombre: usuario.nombre })
    setCambiarPassword(false)
    setPasswordNueva('')
    setPasswordConfirmar('')
    setErrorEditar(null)
    setMensaje(null)
  }

  async function confirmarEditar(event) {
    event.preventDefault()
    if (!formEditar.usuario.trim() || !formEditar.nombre.trim()) {
      setErrorEditar('Complete el usuario y el nombre.')
      return
    }
    if (editando.rol !== 'Supervisor' && cambiarPassword) {
      if (passwordNueva.length < 6) {
        setErrorEditar('La contraseña debe tener al menos 6 caracteres.')
        return
      }
      if (passwordNueva !== passwordConfirmar) {
        setErrorEditar('La contraseña y su confirmación no coinciden.')
        return
      }
    }

    setGuardandoEdicion(true)
    setErrorEditar(null)
    try {
      await editarUsuario(editando.id, { usuario: formEditar.usuario.trim(), nombre: formEditar.nombre.trim() }, token)
      if (editando.rol !== 'Supervisor' && cambiarPassword) {
        await cambiarPasswordCajero(editando.id, passwordNueva, token)
      }
      setEditando(null)
      setMensaje({ ok: true, texto: `Usuario "${formEditar.usuario.trim()}" actualizado correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEditar(err.mensaje || err.message)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  function pedirCambioEstado(usuario) {
    setCambiandoEstadoDe(usuario)
    setErrorEstado(null)
    setMensaje(null)
  }

  async function confirmarCambioEstado() {
    setGuardandoEstado(true)
    setErrorEstado(null)
    const activar = cambiandoEstadoDe.estado !== 'Activo'
    try {
      await cambiarEstadoUsuario(cambiandoEstadoDe.id, activar, token)
      setMensaje({ ok: true, texto: `Usuario "${cambiandoEstadoDe.usuario}" ${activar ? 'activado' : 'desactivado'} correctamente.` })
      setCambiandoEstadoDe(null)
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEstado(err.mensaje || err.message)
    } finally {
      setGuardandoEstado(false)
    }
  }

  return (
    <section className="adm-pagina">
      <div className="adm-cabecera">
        <div className="turno-encabezado">
          <h1>Usuarios</h1>
          <p>Cuentas de cajeros, supervisores, encargados de devoluciones y personal de soporte.</p>
        </div>
        <Boton icono={Plus} onClick={abrirNuevo}>
          Nuevo usuario
        </Boton>
      </div>

      <div className="adm-filtros">
        <Selector etiqueta="Rol" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
          {FILTROS_ROL.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </Selector>
      </div>

      {mensaje && <Alerta tono={mensaje.ok ? 'exito' : 'error'} titulo={mensaje.texto} />}

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && usuariosFiltrados.length === 0 && (
        <EstadoVacio titulo="No hay usuarios que coincidan con el filtro." />
      )}

      {!cargando && !error && usuariosFiltrados.length > 0 && (
        <Tabla etiqueta="Usuarios">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map((u) => (
              <tr key={`${u.rol}-${u.id}`}>
                <td>{u.usuario}</td>
                <td>{u.nombre}</td>
                <td>{u.rol}</td>
                <td>
                  <Chip tono={TONO_ESTADO[u.estado]}>{u.estado}</Chip>
                </td>
                <td>
                  <div className="adm-acciones">
                    <Boton variante="fantasma" onClick={() => abrirEditar(u)}>
                      Editar
                    </Boton>
                    <Boton
                      variante="fantasma"
                      className={u.estado === 'Activo' ? 'adm-accion--peligro' : ''}
                      onClick={() => pedirCambioEstado(u)}
                    >
                      {u.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                    </Boton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      {mostrandoNuevo && (
        <Modal abierto titulo="Nuevo usuario" onCerrar={creando ? undefined : () => setMostrandoNuevo(false)}>
          <form className="adm-form" onSubmit={confirmarNuevo}>
            <Selector etiqueta="Rol del nuevo usuario" value={nuevo.rol}
              onChange={(e) => setNuevo((prev) => ({ ...prev, rol: e.target.value }))}>
              <option value="Cajero">Cajero</option>
              {rolesPersonal.map((r) => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
            </Selector>
            <CampoTexto
              etiqueta="Usuario (correo)"
              type="email"
              autoComplete="off"
              value={nuevo.usuario}
              onChange={(e) => setNuevo((prev) => ({ ...prev, usuario: e.target.value }))}
              autoFocus
            />
            <CampoTexto
              etiqueta="Nombre"
              type="text"
              value={nuevo.nombre}
              onChange={(e) => setNuevo((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <CampoContrasena
              etiqueta="Contraseña (mínimo 6 caracteres)"
              autoComplete="new-password"
              value={nuevo.password}
              onChange={(e) => setNuevo((prev) => ({ ...prev, password: e.target.value }))}
            />
            <CampoContrasena
              etiqueta="Confirmar contraseña"
              autoComplete="new-password"
              value={nuevo.confirmarPassword}
              onChange={(e) => setNuevo((prev) => ({ ...prev, confirmarPassword: e.target.value }))}
            />

            {errorNuevo && <Alerta tono="error" titulo={errorNuevo} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={() => setMostrandoNuevo(false)} disabled={creando}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={creando}>
                {creando ? 'Guardando...' : 'Guardar'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}

      {editando && (
        <Modal
          abierto
          titulo={`Editar ${editando.rol.toLowerCase()}`}
          onCerrar={guardandoEdicion ? undefined : () => setEditando(null)}
        >
          <form className="adm-form" onSubmit={confirmarEditar}>
            <CampoTexto
              etiqueta="Usuario"
              type="text"
              autoComplete="off"
              value={formEditar.usuario}
              onChange={(e) => setFormEditar((prev) => ({ ...prev, usuario: e.target.value }))}
              autoFocus
            />
            <CampoTexto
              etiqueta="Nombre"
              type="text"
              value={formEditar.nombre}
              onChange={(e) => setFormEditar((prev) => ({ ...prev, nombre: e.target.value }))}
            />

            {editando.rol !== 'Supervisor' && (
              <>
                <div>
                  <Boton
                    variante={cambiarPassword ? 'primario' : 'contorno'}
                    aria-pressed={cambiarPassword}
                    onClick={() => setCambiarPassword((v) => !v)}
                  >
                    Cambiar contraseña
                  </Boton>
                </div>

                {cambiarPassword && (
                  <>
                    <CampoContrasena
                      etiqueta="Contraseña nueva (mínimo 6 caracteres)"
                      autoComplete="new-password"
                      value={passwordNueva}
                      onChange={(e) => setPasswordNueva(e.target.value)}
                    />
                    <CampoContrasena
                      etiqueta="Confirmar contraseña"
                      autoComplete="new-password"
                      value={passwordConfirmar}
                      onChange={(e) => setPasswordConfirmar(e.target.value)}
                    />
                  </>
                )}
              </>
            )}

            {errorEditar && <Alerta tono="error" titulo={errorEditar} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={() => setEditando(null)} disabled={guardandoEdicion}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={guardandoEdicion}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}

      {cambiandoEstadoDe && (
        <Modal
          abierto
          titulo={`${cambiandoEstadoDe.estado === 'Activo' ? 'Desactivar' : 'Activar'} usuario`}
          onCerrar={guardandoEstado ? undefined : () => setCambiandoEstadoDe(null)}
          acciones={
            <>
              <Boton variante="contorno" onClick={() => setCambiandoEstadoDe(null)} disabled={guardandoEstado}>
                Cancelar
              </Boton>
              <Boton
                variante={cambiandoEstadoDe.estado === 'Activo' ? 'peligro' : 'primario'}
                onClick={confirmarCambioEstado}
                disabled={guardandoEstado}
              >
                {guardandoEstado ? 'Guardando...' : 'Sí, confirmar'}
              </Boton>
            </>
          }
        >
          <div className="adm-form">
            <p>
              ¿Desea {cambiandoEstadoDe.estado === 'Activo' ? 'desactivar' : 'activar'} a{' '}
              <strong>{cambiandoEstadoDe.usuario}</strong> ({cambiandoEstadoDe.nombre})?
              {cambiandoEstadoDe.estado === 'Activo' &&
                ' Mientras esté desactivado no va a poder iniciar sesión ni autorizar nada.'}
            </p>
            {errorEstado && <Alerta tono="error" titulo={errorEstado} />}
          </div>
        </Modal>
      )}
    </section>
  )
}

export default Usuarios
