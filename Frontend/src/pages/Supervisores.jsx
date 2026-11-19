import { useEffect, useState } from 'react'
import { listarSupervisores, crearSupervisor, restablecerPinSupervisor, cambiarEstadoSupervisor } from '../api/supervisores.js'
import { Plus } from 'lucide-react'
import { Alerta, Boton, CampoContrasena, CampoTexto, Chip, EstadoVacio, Modal, Tabla } from '../components/ui'
import './turno.css'
import './admin.css'

const PIN_REGEX = /^\d{4,6}$/
const TONO_ESTADO = { Activo: 'exito', Inactivo: 'neutro', Bloqueado: 'error' }
const NUEVO_SUPERVISOR_INICIAL = { usuario: '', nombre: '', pin: '', confirmarPin: '' }

// TDSI-188/725-728: pantalla "Supervisores" del Administrador -- alta, restablecer
// PIN y activar/desactivar, con los mismos supervisores que validan las autorizaciones
// de cierre, anulacion y modificacion en todo el sistema.
function Supervisores() {
  const [supervisores, setSupervisores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [recargar, setRecargar] = useState(0)
  const [mensaje, setMensaje] = useState(null)

  const [mostrandoNuevo, setMostrandoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState(NUEVO_SUPERVISOR_INICIAL)
  const [creando, setCreando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState(null)

  const [supervisorPin, setSupervisorPin] = useState(null)
  const [pinNuevo, setPinNuevo] = useState('')
  const [pinConfirmar, setPinConfirmar] = useState('')
  const [restableciendo, setRestableciendo] = useState(false)
  const [errorPin, setErrorPin] = useState(null)

  const [supervisorEstado, setSupervisorEstado] = useState(null) // { id, nombre, activo } del que se va a (des)activar
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [errorEstado, setErrorEstado] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    listarSupervisores()
      .then((r) => vigente && setSupervisores(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [recargar])

  function abrirNuevo() {
    setNuevo(NUEVO_SUPERVISOR_INICIAL)
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
    if (!PIN_REGEX.test(nuevo.pin)) {
      setErrorNuevo('El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    if (nuevo.pin !== nuevo.confirmarPin) {
      setErrorNuevo('El PIN y su confirmación no coinciden.')
      return
    }
    setCreando(true)
    setErrorNuevo(null)
    try {
      await crearSupervisor({ usuario: nuevo.usuario.trim(), nombre: nuevo.nombre.trim(), pin: nuevo.pin })
      setMostrandoNuevo(false)
      setMensaje({ ok: true, texto: `Supervisor "${nuevo.usuario.trim()}" registrado correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorNuevo(err.mensaje || err.message)
    } finally {
      setCreando(false)
    }
  }

  function abrirPin(supervisor) {
    setSupervisorPin(supervisor)
    setPinNuevo('')
    setPinConfirmar('')
    setErrorPin(null)
    setMensaje(null)
  }

  async function confirmarPin(event) {
    event.preventDefault()
    if (!PIN_REGEX.test(pinNuevo)) {
      setErrorPin('El PIN debe tener entre 4 y 6 dígitos.')
      return
    }
    if (pinNuevo !== pinConfirmar) {
      setErrorPin('El PIN y su confirmación no coinciden.')
      return
    }
    setRestableciendo(true)
    setErrorPin(null)
    try {
      await restablecerPinSupervisor(supervisorPin.id, pinNuevo)
      setSupervisorPin(null)
      setMensaje({ ok: true, texto: `PIN de "${supervisorPin.usuario}" restablecido correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorPin(err.mensaje || err.message)
    } finally {
      setRestableciendo(false)
    }
  }

  function pedirCambioEstado(supervisor) {
    setSupervisorEstado(supervisor)
    setErrorEstado(null)
    setMensaje(null)
  }

  async function confirmarCambioEstado() {
    setCambiandoEstado(true)
    setErrorEstado(null)
    const activar = !supervisorEstado.activo
    try {
      await cambiarEstadoSupervisor(supervisorEstado.id, activar)
      setSupervisorEstado(null)
      setMensaje({ ok: true, texto: `Supervisor "${supervisorEstado.usuario}" ${activar ? 'activado' : 'desactivado'} correctamente.` })
      setRecargar((n) => n + 1)
    } catch (err) {
      setErrorEstado(err.mensaje || err.message)
    } finally {
      setCambiandoEstado(false)
    }
  }

  return (
    <section className="adm-pagina">
      <div className="adm-cabecera">
        <div className="turno-encabezado">
          <h1>Supervisores</h1>
          <p>Supervisores de caja que autorizan cierres, anulaciones y modificaciones con su usuario y PIN.</p>
        </div>
        <Boton icono={Plus} onClick={abrirNuevo}>
          Nuevo supervisor
        </Boton>
      </div>

      {mensaje && <Alerta tono={mensaje.ok ? 'exito' : 'error'} titulo={mensaje.texto} />}

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && supervisores.length === 0 && (
        <EstadoVacio titulo="Todavía no hay supervisores registrados." />
      )}

      {!cargando && !error && supervisores.length > 0 && (
        <Tabla etiqueta="Supervisores">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Actualizado</th>
              <th aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            {supervisores.map((s) => (
              <tr key={s.id}>
                <td>{s.usuario}</td>
                <td>{s.nombre}</td>
                <td>
                  <Chip tono={TONO_ESTADO[s.estado]}>{s.estado}</Chip>
                </td>
                <td>{s.actualizado_en ? new Date(s.actualizado_en).toLocaleString() : '—'}</td>
                <td>
                  <div className="adm-acciones">
                    <Boton variante="fantasma" onClick={() => abrirPin(s)}>
                      Restablecer PIN
                    </Boton>
                    <Boton
                      variante="fantasma"
                      className={s.activo ? 'adm-accion--peligro' : ''}
                      onClick={() => pedirCambioEstado(s)}
                    >
                      {s.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}

      {mostrandoNuevo && (
        <Modal abierto titulo="Nuevo supervisor" onCerrar={creando ? undefined : () => setMostrandoNuevo(false)}>
          <form className="adm-form" onSubmit={confirmarNuevo}>
            <CampoTexto
              etiqueta="Usuario"
              type="text"
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
              etiqueta="PIN (4 a 6 dígitos)"
              inputMode="numeric"
              autoComplete="new-password"
              value={nuevo.pin}
              onChange={(e) => setNuevo((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
            />
            <CampoContrasena
              etiqueta="Confirmar PIN"
              inputMode="numeric"
              autoComplete="new-password"
              value={nuevo.confirmarPin}
              onChange={(e) => setNuevo((prev) => ({ ...prev, confirmarPin: e.target.value.replace(/\D/g, '') }))}
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

      {supervisorPin && (
        <Modal abierto titulo="Restablecer PIN" onCerrar={restableciendo ? undefined : () => setSupervisorPin(null)}>
          <form className="adm-form" onSubmit={confirmarPin}>
            <p className="adm-nota">
              Supervisor: <strong>{supervisorPin.usuario}</strong> ({supervisorPin.nombre})
            </p>
            <CampoContrasena
              etiqueta="PIN nuevo (4 a 6 dígitos)"
              inputMode="numeric"
              autoComplete="new-password"
              value={pinNuevo}
              onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <CampoContrasena
              etiqueta="Confirmar PIN"
              inputMode="numeric"
              autoComplete="new-password"
              value={pinConfirmar}
              onChange={(e) => setPinConfirmar(e.target.value.replace(/\D/g, ''))}
            />

            {errorPin && <Alerta tono="error" titulo={errorPin} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={() => setSupervisorPin(null)} disabled={restableciendo}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={restableciendo}>
                {restableciendo ? 'Guardando...' : 'Restablecer PIN'}
              </Boton>
            </div>
          </form>
        </Modal>
      )}

      {supervisorEstado && (
        <Modal
          abierto
          titulo={`${supervisorEstado.activo ? 'Desactivar' : 'Activar'} supervisor`}
          onCerrar={cambiandoEstado ? undefined : () => setSupervisorEstado(null)}
          acciones={
            <>
              <Boton variante="contorno" onClick={() => setSupervisorEstado(null)} disabled={cambiandoEstado}>
                Cancelar
              </Boton>
              <Boton
                variante={supervisorEstado.activo ? 'peligro' : 'primario'}
                onClick={confirmarCambioEstado}
                disabled={cambiandoEstado}
              >
                {cambiandoEstado ? 'Guardando...' : 'Sí, confirmar'}
              </Boton>
            </>
          }
        >
          <div className="adm-form">
            <p>
              ¿Desea {supervisorEstado.activo ? 'desactivar' : 'activar'} a <strong>{supervisorEstado.usuario}</strong>{' '}
              ({supervisorEstado.nombre})?
              {supervisorEstado.activo && ' Mientras esté desactivado no va a poder autorizar nada con su PIN.'}
            </p>
            {errorEstado && <Alerta tono="error" titulo={errorEstado} />}
          </div>
        </Modal>
      )}
    </section>
  )
}

export default Supervisores
