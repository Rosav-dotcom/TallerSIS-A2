import { useEffect, useState } from 'react'
import { obtenerTurnoActual } from '../api/turnos.js'
import { abrirTurno } from '../api/caja.js'
import { useAuth } from '../context/AuthContext.jsx'
import CampoPassword from './CampoPassword.jsx'
import { Alerta, Boton, CampoTexto, Modal } from './ui'
import '../pages/turno.css'

const FORM_INICIAL = { efectivoInicial: '', supervisorId: '', pin: '' }

// Aparece al entrar a la pantalla principal: avisa si el turno de esta caja
// esta activo o inactivo. Si esta activo, solo se continua. Si esta inactivo,
// exige abrirlo (con usuario + PIN de un supervisor) antes de dejar seguir.
function TurnoModal() {
  const { cajero } = useAuth()
  const [estado, setEstado] = useState('verificando') // verificando | activo | inactivo | abierto
  const [turno, setTurno] = useState(null)
  const [cerrado, setCerrado] = useState(false)
  const [datos, setDatos] = useState(FORM_INICIAL)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cajero?.caja) return
    let vigente = true

    obtenerTurnoActual(cajero.caja)
      .then((respuesta) => {
        if (!vigente) return
        setTurno(respuesta.data)
        setEstado('activo')
      })
      .catch(() => {
        if (vigente) setEstado('inactivo')
      })

    return () => {
      vigente = false
    }
  }, [cajero?.caja])

  function actualizarCampo(campo, valor) {
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  async function abrir(event) {
    event.preventDefault()

    if (!datos.efectivoInicial) {
      setError('Ingrese el efectivo inicial con el que arranca la caja.')
      return
    }
    if (!datos.supervisorId.trim() || !datos.pin.trim()) {
      setError('Se necesita el usuario y el PIN de un supervisor para habilitar la caja.')
      return
    }

    setEnviando(true)
    setError(null)

    try {
      const respuesta = await abrirTurno({
        caja_id: cajero.caja,
        cajero_id: cajero.nombre,
        efectivo_inicial: Number(datos.efectivoInicial),
        supervisor_id: datos.supervisorId.trim(),
        pin: datos.pin.trim(),
      })
      setTurno(respuesta.data)
      setEstado('abierto')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (cerrado || estado === 'verificando') return null

  const titulo =
    estado === 'activo' ? 'Turno activo' : estado === 'inactivo' ? 'Turno inactivo' : 'Turno abierto correctamente'

  return (
    <Modal abierto titulo={titulo}>
      {estado === 'activo' && (
        <>
          <p className="ui-estado-texto">
            La caja {cajero.caja} ya tiene un turno abierto ({turno.codigo}). Puedes continuar normalmente.
          </p>
          <div className="ui-modal-acciones">
            <Boton onClick={() => setCerrado(true)}>Continuar</Boton>
          </div>
        </>
      )}

      {estado === 'inactivo' && (
        <>
          <p className="ui-estado-texto">
            La caja {cajero?.caja} no tiene un turno abierto. Para habilitarla, un supervisor de caja debe ingresar su
            usuario y PIN aquí mismo.
          </p>
          <form className="turno-columna" onSubmit={abrir}>
            <CampoTexto
              etiqueta="Efectivo inicial (Bs.)"
              prefijo="Bs"
              type="number"
              step="0.01"
              min="0"
              value={datos.efectivoInicial}
              onChange={(e) => actualizarCampo('efectivoInicial', e.target.value)}
            />

            <CampoTexto
              etiqueta="Usuario del supervisor"
              type="text"
              autoComplete="off"
              value={datos.supervisorId}
              onChange={(e) => actualizarCampo('supervisorId', e.target.value)}
            />

            <label className="ui-campo">
              <span className="ui-campo-etiqueta">PIN del supervisor</span>
              <span className="ui-control">
                <CampoPassword
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={datos.pin}
                  onChange={(e) => actualizarCampo('pin', e.target.value)}
                />
              </span>
            </label>

            {error && <Alerta tono="error" titulo={error} />}

            <Boton type="submit" ancho disabled={enviando}>
              {enviando ? 'Abriendo turno...' : 'Abrir turno'}
            </Boton>
            <span className="ui-campo-ayuda">Esta autorización quedará registrada en la auditoría.</span>
          </form>
        </>
      )}

      {estado === 'abierto' && (
        <>
          <dl className="turno-datos">
            <div>
              <dt>Turno</dt>
              <dd>{turno.codigo}</dd>
            </div>
            <div>
              <dt>Efectivo inicial</dt>
              <dd>Bs. {turno.efectivo_inicial}</dd>
            </div>
            <div>
              <dt>Autorizó</dt>
              <dd>
                {turno.autorizado_por_nombre} ({turno.autorizado_por})
              </dd>
            </div>
          </dl>
          <div className="ui-modal-acciones">
            <Boton onClick={() => setCerrado(true)}>Continuar</Boton>
          </div>
        </>
      )}
    </Modal>
  )
}

export default TurnoModal
