import { useEffect, useRef, useState } from 'react'
import { listarMisFacturas, anularVenta, modificarVenta, urlFacturaPdf } from '../api/pagos.js'
import { obtenerAnuladasTurno } from '../api/caja.js'
import { obtenerTurnoActual } from '../api/turnos.js'
import { validarMotivoAnulacion, LARGO_MAXIMO_ANULACION } from '../api/respuestasAnulacion.js'
import RespuestasAnulacionBotones from '../components/RespuestasAnulacionBotones.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import BuscadorFacturas from '../components/BuscadorFacturas.jsx'
import useDebounce from '../hooks/useDebounce.js'
import useResumenFactura from '../hooks/useResumenFactura.js'
import ResumenFactura from '../components/ResumenFactura.jsx'
import ComparacionModificacion from '../components/ComparacionModificacion.jsx'
import CampoPassword from '../components/CampoPassword.jsx'
import { Alerta, Boton, CampoTexto, Chip, EstadoCargando, EstadoVacio, Modal, Tabla, Tarjeta } from '../components/ui'
import './turno.css'
import './facturas.css'

const PLAZO_ANULACION_MS = 2 * 60 * 60 * 1000 // 2 horas

const ESTADOS = {
  Registrado: { texto: 'Emitida', clase: 'badge-estado--emitida' },
  AnulacionSolicitada: { texto: 'Anulación solicitada', clase: 'badge-estado--solicitada' },
  Anulado: { texto: 'Anulada', clase: '' },
}

// Tono del chip de estado (solo presentación).
const TONO_ESTADO = { Registrado: 'exito', AnulacionSolicitada: 'advertencia', Anulado: 'neutro' }

// TDSI-48: panel "Mis respuestas de anulación" (va aparte de los imports de arriba para no
// chocar al unir ramas que tambien los modifican).
import MisRespuestasAnulacion from '../components/MisRespuestasAnulacion.jsx'

function dentroDelPlazo(fecha) {
  return Date.now() - new Date(fecha).getTime() <= PLAZO_ANULACION_MS
}

// TDSI-37/569: "1h 23m restantes" a partir de la fecha de emision.
function tiempoRestanteTexto(fecha) {
  const msRestante = PLAZO_ANULACION_MS - (Date.now() - new Date(fecha).getTime())
  if (msRestante <= 0) return null
  const minutosTotales = Math.floor(msRestante / 60000)
  const horas = Math.floor(minutosTotales / 60)
  const minutos = minutosTotales % 60
  return horas > 0 ? `${horas}h ${minutos}m restantes` : `${minutos}m restantes`
}

const CREDENCIALES_INICIAL = { supervisor_id: '', pin: '' }
const TIPOS_DOCUMENTO_MOD = [
  { id: 'NIT', etiqueta: 'NIT' },
  { id: 'CI', etiqueta: 'CI' },
]
const REGEX_DOCUMENTO_MOD = { NIT: /^\d{10}$/, CI: /^\d{7,8}$/ }
const MAX_LARGO_DOCUMENTO_MOD = { NIT: 10, CI: 8 }

// TDSI-306: el cajero ve solo sus propias ventas y puede anularlas (dentro de 2
// horas) pidiendo el usuario + PIN de un supervisor de caja, con una pregunta
// de seguridad final antes de anular de verdad.
function Facturas() {
  const { cajero } = useAuth()
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)
  const [mensaje, setMensaje] = useState(null) // { ok, texto } | null

  // Filtro por rango de fechas (TDSI-307): vacio = sin límite en ese extremo.
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  // TDSI-46: buscador por número, NIT/CI o nombre. La búsqueda la resuelve el backend
  // (parámetro "q"); aquí solo se espera 400 ms tras dejar de escribir (TDSI-868).
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounce(busqueda, 400)
  const termino = busqueda.trim() === '' ? '' : busquedaDebounced.trim() // vacío = todo al instante
  const peticionActual = useRef(0) // evita que una respuesta vieja pise a una más nueva

  // Paso 1: factura elegida + ventana emergente de credenciales del supervisor.
  const [facturaParaAnular, setFacturaParaAnular] = useState(null)
  const [credenciales, setCredenciales] = useState(CREDENCIALES_INICIAL)
  const [errorCredenciales, setErrorCredenciales] = useState(null)
  // TDSI-48/896-897: motivo de la anulación -- con un clic en una respuesta guardada se
  // completa solo; si ninguna sirve, el cajero lo escribe a mano (10 a 100 caracteres).
  const [motivoAnulacion, setMotivoAnulacion] = useState('')

  // Paso 2: pregunta de seguridad final, antes de anular de verdad.
  const [pidiendoConfirmacion, setPidiendoConfirmacion] = useState(false)
  const [anulando, setAnulando] = useState(false)

  // TDSI-37: modificar los datos de facturacion de una venta ya registrada
  // (ej. un NIT mal escrito), autorizado por un supervisor, dentro de 2 horas.
  const [facturaParaModificar, setFacturaParaModificar] = useState(null)
  const [formModificar, setFormModificar] = useState(null)
  const [credencialesModificar, setCredencialesModificar] = useState(CREDENCIALES_INICIAL)
  const [errorModificar, setErrorModificar] = useState(null)
  const [modificando, setModificando] = useState(false)
  const [tiempoRestante, setTiempoRestante] = useState(null)

  // TDSI-49: "Anuladas en el turno" -- mismas facturas y el mismo endpoint que ya usa
  // el reporte de Cierre de caja (obtenerAnuladasTurno), pero accesible en cualquier
  // momento del turno, no solo al cerrar.
  const [mostrandoAnuladasTurno, setMostrandoAnuladasTurno] = useState(false)
  const [cargandoAnuladasTurno, setCargandoAnuladasTurno] = useState(false)
  const [errorAnuladasTurno, setErrorAnuladasTurno] = useState(null)
  const [anuladasTurno, setAnuladasTurno] = useState(null)

  // TDSI-59: resumen de la factura que se muestra antes del PIN del supervisor
  // (anulación o modificación; solo hay una ventana abierta a la vez).
  const {
    resumen,
    cargando: cargandoResumen,
    error: errorResumen,
    reintentar: reintentarResumen,
  } = useResumenFactura(
    facturaParaAnular?.id_transaccion ?? facturaParaModificar?.id_transaccion ?? null,
    cajero?.nombre,
  )
  // TDSI-909: se muestra el N° de factura, no el número interno de la transacción
  const numeroFactura =
    resumen?.numero_factura ??
    resumen?.nro_factura ??
    resumen?.numero ??
    facturaParaAnular?.numero_factura ??
    facturaParaModificar?.numero_factura ??
    null

  async function cargarFacturas() {
    if (!cajero) return
    const numeroPeticion = ++peticionActual.current
    setCargando(true)
    try {
      // TDSI-869: la búsqueda (q) viaja junto al rango de fechas, no lo reemplaza.
      const respuesta = await listarMisFacturas(cajero.nombre, { desde: filtroDesde, hasta: filtroHasta, q: termino })
      if (numeroPeticion !== peticionActual.current) return
      setFacturas(respuesta.data)
      setErrorCarga(null)
    } catch (err) {
      if (numeroPeticion !== peticionActual.current) return
      setErrorCarga(err.message)
    } finally {
      if (numeroPeticion === peticionActual.current) setCargando(false)
    }
  }

  useEffect(() => {
    cargarFacturas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cajero, filtroDesde, filtroHasta, termino])

  // TDSI-870: "Limpiar" también vacía el buscador.
  function limpiarFiltro() {
    setFiltroDesde('')
    setFiltroHasta('')
    setBusqueda('')
  }

  function abrirVentanaCredenciales(factura) {
    setFacturaParaAnular(factura)
    setCredenciales(CREDENCIALES_INICIAL)
    setErrorCredenciales(null)
    setMotivoAnulacion('')
    setPidiendoConfirmacion(false)
    setMensaje(null)
  }

  function cerrarTodo() {
    setFacturaParaAnular(null)
    setPidiendoConfirmacion(false)
    setErrorCredenciales(null)
    setMotivoAnulacion('')
  }

  function actualizarCredencial(campo, valor) {
    setCredenciales((prev) => ({ ...prev, [campo]: valor }))
  }

  // Al aceptar las credenciales, todavía no se anula nada: primero se pregunta
  // "¿está seguro?" y recién ahí se llama al backend con el PIN.
  function aceptarCredenciales(event) {
    event.preventDefault()
    const errorMotivo = validarMotivoAnulacion(motivoAnulacion)
    if (errorMotivo) {
      setErrorCredenciales(errorMotivo)
      return
    }
    if (!credenciales.supervisor_id.trim() || !credenciales.pin.trim()) {
      setErrorCredenciales('Ingrese el usuario y el PIN del supervisor.')
      return
    }
    setErrorCredenciales(null)
    setPidiendoConfirmacion(true)
  }

  async function confirmarAnulacion() {
    setAnulando(true)
    try {
      await anularVenta(facturaParaAnular.id_transaccion, {
        cajero: cajero?.nombre,
        supervisor_id: credenciales.supervisor_id.trim(),
        pin: credenciales.pin.trim(),
        motivo: motivoAnulacion.trim(),
      })
      setMensaje({ ok: true, texto: `La factura ${facturaParaAnular.id_transaccion} fue anulada.` })
      cerrarTodo()
      await cargarFacturas()
    } catch (err) {
      // El PIN pudo ser incorrecto o el plazo vencio justo ahora: se vuelve a
      // pedir las credenciales mostrando el motivo, en vez de perder el flujo.
      setPidiendoConfirmacion(false)
      setErrorCredenciales(err.message)
    } finally {
      setAnulando(false)
    }
  }

  function abrirModificar(factura) {
    setFacturaParaModificar(factura)
    setFormModificar({
      tipoDocumento: factura.tipo_documento || 'NIT',
      numeroDocumento: factura.nit || '',
      razonSocial: factura.razon_social || '',
      telefono: factura.telefono || '',
    })
    setCredencialesModificar(CREDENCIALES_INICIAL)
    setErrorModificar(null)
    setTiempoRestante(tiempoRestanteTexto(factura.fecha))
    setMensaje(null)
  }

  function cerrarModificar() {
    setFacturaParaModificar(null)
    setFormModificar(null)
    setErrorModificar(null)
  }

  // TDSI-49: busca el turno abierto de la caja del cajero y trae sus facturas anuladas.
  async function abrirAnuladasTurno() {
    setMostrandoAnuladasTurno(true)
    setCargandoAnuladasTurno(true)
    setErrorAnuladasTurno(null)
    setAnuladasTurno(null)
    try {
      const { data: turno } = await obtenerTurnoActual(cajero.caja)
      if (!turno) {
        setErrorAnuladasTurno('No tienes un turno abierto en este momento.')
        return
      }
      const { data } = await obtenerAnuladasTurno(turno.id)
      setAnuladasTurno(data)
    } catch (err) {
      setErrorAnuladasTurno(err.mensaje || err.message)
    } finally {
      setCargandoAnuladasTurno(false)
    }
  }

  function cerrarAnuladasTurno() {
    setMostrandoAnuladasTurno(false)
  }

  function actualizarFormModificar(campo, valor) {
    setFormModificar((prev) => ({ ...prev, [campo]: valor }))
  }

  function actualizarCredencialModificar(campo, valor) {
    setCredencialesModificar((prev) => ({ ...prev, [campo]: valor }))
  }

  // TDSI-37/569: mientras el modal esta abierto, el tiempo restante se actualiza
  // solo cada segundo, y se bloquea el envio apenas pasan las 2 horas.
  useEffect(() => {
    if (!facturaParaModificar) return
    const intervalo = setInterval(() => {
      setTiempoRestante(tiempoRestanteTexto(facturaParaModificar.fecha))
    }, 1000)
    return () => clearInterval(intervalo)
  }, [facturaParaModificar])

  async function enviarModificacion(event) {
    event.preventDefault()
    if (!tiempoRestante) {
      setErrorModificar('Ya pasaron las 2 horas desde la emisión; esta factura ya no se puede modificar.')
      return
    }
    if (!credencialesModificar.supervisor_id.trim() || !credencialesModificar.pin.trim()) {
      setErrorModificar('Ingrese el usuario y el PIN del supervisor.')
      return
    }
    if (!formModificar.numeroDocumento.trim() || !formModificar.razonSocial.trim()) {
      setErrorModificar('Complete el número de documento y la razón social.')
      return
    }
    if (!REGEX_DOCUMENTO_MOD[formModificar.tipoDocumento].test(formModificar.numeroDocumento.trim())) {
      setErrorModificar(
        formModificar.tipoDocumento === 'NIT' ? 'El NIT debe tener exactamente 10 dígitos.' : 'El CI debe tener entre 7 y 8 dígitos.',
      )
      return
    }

    setModificando(true)
    setErrorModificar(null)
    try {
      await modificarVenta(facturaParaModificar.id_transaccion, {
        supervisor_id: credencialesModificar.supervisor_id.trim(),
        pin: credencialesModificar.pin.trim(),
        modificado_por: cajero?.nombre,
        tipo_documento: formModificar.tipoDocumento,
        nit: formModificar.numeroDocumento.trim(),
        razon_social: formModificar.razonSocial.trim(),
        telefono: formModificar.telefono.trim() || null,
      })
      setMensaje({ ok: true, texto: `La factura ${facturaParaModificar.id_transaccion} fue modificada correctamente.` })
      cerrarModificar()
      await cargarFacturas()
    } catch (err) {
      // TDSI-570: PIN incorrecto o fuera de plazo -- se muestra el error y no se modifica nada.
      setErrorModificar(err.message)
    } finally {
      setModificando(false)
    }
  }

  return (
    <section className="fac-pagina">
      <div className="fac-cabecera">
        <div className="turno-encabezado">
          <h1>Facturas</h1>
          <p className="resumen-turno-actual">Ventas emitidas por {cajero ? cajero.nombre : 'sin sesión iniciada'}.</p>
        </div>
        {cajero && (
          <div className="fac-cabecera-acciones">
            <MisRespuestasAnulacion cajeroId={cajero.nombre} />
            <Boton variante="contorno" onClick={abrirAnuladasTurno}>
              Anuladas en el turno
            </Boton>
          </div>
        )}
      </div>

      <div className="fac-filtros">
        <CampoTexto
          etiqueta="Desde"
          type="date"
          value={filtroDesde}
          max={filtroHasta || undefined}
          onChange={(e) => setFiltroDesde(e.target.value)}
        />
        <CampoTexto
          etiqueta="Hasta"
          type="date"
          value={filtroHasta}
          min={filtroDesde || undefined}
          onChange={(e) => setFiltroHasta(e.target.value)}
        />
        {/* TDSI-170: buscador con lupa junto al filtro de fechas */}
        <label className="ui-campo fac-buscar">
          <span className="ui-campo-etiqueta">Buscar</span>
          <BuscadorFacturas valor={busqueda} onChange={setBusqueda} />
        </label>
        {(filtroDesde || filtroHasta || busqueda) && (
          <Boton variante="fantasma" onClick={limpiarFiltro}>
            Limpiar
          </Boton>
        )}
      </div>

      {mensaje && (
        <div className="fac-aviso">
          <Alerta tono={mensaje.ok ? 'exito' : 'error'} titulo={mensaje.texto} />
        </div>
      )}

      {cargando && <EstadoCargando texto="Cargando..." />}
      {errorCarga && (
        <div className="fac-aviso">
          <Alerta tono="error" titulo={`Error: ${errorCarga}`} />
        </div>
      )}

      {!cargando && !errorCarga && facturas.length === 0 && (
        <Tarjeta>
          <EstadoVacio
            titulo={
              termino
                ? 'No se encontraron facturas' // TDSI-871
                : filtroDesde || filtroHasta
                  ? 'No hay facturas en ese rango de fechas.'
                  : 'Todavía no emitiste ninguna factura.'
            }
          />
        </Tarjeta>
      )}

      {facturas.length > 0 && (
        <Tabla etiqueta="Facturas emitidas">
          <thead>
            <tr>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Método(s)</th>
              <th className="ui-num">Total (Bs.)</th>
              <th>Atendido por</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {facturas.map((factura) => {
              const estado = ESTADOS[factura.estado] ?? { texto: factura.estado, clase: '' }
              const puedeAnular = factura.estado === 'Registrado' && dentroDelPlazo(factura.fecha)
              return (
                <tr key={factura.id_transaccion}>
                  <td>{factura.id_transaccion}</td>
                  <td>{new Date(factura.fecha).toLocaleString()}</td>
                  <td>{factura.razon_social || 'Consumidor final'}</td>
                  <td>{factura.metodos.join(' + ')}</td>
                  <td className="ui-num">{factura.total.toFixed(2)}</td>
                  <td>
                    {factura.cajero_nombre}
                    {factura.caja_id && <span className="fac-detalle"> Caja N° {factura.caja_id}</span>}
                  </td>
                  <td>
                    <Chip tono={TONO_ESTADO[factura.estado] || 'neutro'}>{estado.texto}</Chip>
                  </td>
                  <td>
                    <div className="fac-acciones">
                      <a
                        href={urlFacturaPdf(factura.id_transaccion)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ui-boton ui-boton--fantasma"
                      >
                        Ver
                      </a>
                      {puedeAnular && (
                        <Boton
                          variante="fantasma"
                          className="fac-accion--peligro"
                          onClick={() => abrirVentanaCredenciales(factura)}
                        >
                          Anular factura
                        </Boton>
                      )}
                      {puedeAnular && (
                        <Boton variante="fantasma" onClick={() => abrirModificar(factura)}>
                          Modificar factura
                        </Boton>
                      )}
                      {factura.estado === 'AnulacionSolicitada' && (
                        <span className="fac-nota">Esperando a un supervisor...</span>
                      )}
                      {factura.estado === 'Registrado' && !dentroDelPlazo(factura.fecha) && (
                        <span className="fac-nota">Fuera de plazo (2h)</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Tabla>
      )}

      {/* Ventana emergente 1: usuario + PIN del supervisor de caja */}
      <Modal ancho abierto={Boolean(facturaParaAnular && !pidiendoConfirmacion)} titulo="Autorización de supervisor" onCerrar={cerrarTodo}>
        <form className="fac-form" onSubmit={aceptarCredenciales}>
          <p className="fac-numero">Factura N° {cargandoResumen ? '…' : (numeroFactura ?? '—')}</p>

          {/* TDSI-196 / 907 / 910: resumen de la factura antes de los campos de PIN */}
          <ResumenFactura
            resumen={resumen}
            cargando={cargandoResumen}
            error={errorResumen}
            onReintentar={reintentarResumen}
            factura={facturaParaAnular}
          />

          <p className="fac-nota">Para anular esta factura se necesita el usuario y el PIN de un supervisor de caja.</p>

          <RespuestasAnulacionBotones
            cajeroId={cajero?.nombre}
            onElegir={(texto) => setMotivoAnulacion(texto)}
            disabled={anulando}
          />

          <label className="ui-campo">
            <span className="ui-campo-etiqueta">Motivo de la anulación</span>
            <span className="ui-control ui-control--area">
              <textarea
                rows={2}
                maxLength={LARGO_MAXIMO_ANULACION}
                value={motivoAnulacion}
                onChange={(e) => setMotivoAnulacion(e.target.value)}
                placeholder="Elegí una respuesta de arriba o escribí el motivo (mínimo 10 caracteres)"
              />
            </span>
            <span className="fac-contador">
              {motivoAnulacion.trim().length}/{LARGO_MAXIMO_ANULACION}
            </span>
          </label>

          <CampoTexto
            etiqueta="Usuario del supervisor"
            type="text"
            autoComplete="off"
            value={credenciales.supervisor_id}
            onChange={(e) => actualizarCredencial('supervisor_id', e.target.value)}
            autoFocus
          />

          <label className="ui-campo">
            <span className="ui-campo-etiqueta">PIN</span>
            <span className="ui-control">
              <CampoPassword
                inputMode="numeric"
                autoComplete="new-password"
                value={credenciales.pin}
                onChange={(e) => actualizarCredencial('pin', e.target.value)}
              />
            </span>
          </label>

          {errorCredenciales && <Alerta tono="error" titulo={errorCredenciales} />}

          <div className="ui-modal-acciones">
            <Boton variante="contorno" onClick={cerrarTodo}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={cargandoResumen}>
              Aceptar
            </Boton>
          </div>
          <span className="fac-nota">Esta autorización quedará registrada en la auditoría.</span>
        </form>
      </Modal>

      {/* Ventana emergente 2: pregunta de seguridad final antes de anular de verdad */}
      <Modal
        abierto={Boolean(facturaParaAnular && pidiendoConfirmacion)}
        titulo="¿Está seguro?"
        onCerrar={anulando ? undefined : cerrarTodo}
        acciones={
          <>
            <Boton variante="contorno" onClick={cerrarTodo} disabled={anulando}>
              No
            </Boton>
            <Boton variante="peligro" onClick={confirmarAnulacion} disabled={anulando}>
              {anulando ? 'Anulando...' : 'Sí, anular'}
            </Boton>
          </>
        }
      >
        <p>
          ¿Desea anular la factura número <strong>{numeroFactura ?? facturaParaAnular?.id_transaccion}</strong>? Esta
          acción no se puede deshacer.
        </p>
        <p>Motivo: «{motivoAnulacion.trim()}»</p>
      </Modal>

      {/* TDSI-37: modificar los datos de facturacion de una venta, con PIN de supervisor */}
      <Modal
        ancho
        abierto={Boolean(facturaParaModificar && formModificar)}
        titulo="Modificar factura"
        onCerrar={modificando ? undefined : cerrarModificar}
      >
        {facturaParaModificar && formModificar && (
          <form className="fac-form" onSubmit={enviarModificacion}>
            <p className="fac-numero">Factura N° {cargandoResumen ? '…' : (numeroFactura ?? '—')}</p>

            {tiempoRestante ? (
              <Alerta tono="info" titulo={`${tiempoRestante} para poder modificar esta factura.`} />
            ) : (
              <Alerta tono="error" titulo="Ya pasaron las 2 horas desde la emisión: no se puede modificar." />
            )}

            <ResumenFactura
              resumen={resumen}
              cargando={cargandoResumen}
              error={errorResumen}
              onReintentar={reintentarResumen}
              factura={facturaParaModificar}
            />

            <div className="fac-tipos" role="group" aria-label="Tipo de documento">
              {TIPOS_DOCUMENTO_MOD.map((tipo) => (
                <Boton
                  key={tipo.id}
                  variante={formModificar.tipoDocumento === tipo.id ? 'primario' : 'contorno'}
                  aria-pressed={formModificar.tipoDocumento === tipo.id}
                  onClick={() => actualizarFormModificar('tipoDocumento', tipo.id)}
                >
                  {tipo.etiqueta}
                </Boton>
              ))}
            </div>

            <CampoTexto
              etiqueta={`Número de ${formModificar.tipoDocumento}`}
              type="text"
              inputMode="numeric"
              maxLength={MAX_LARGO_DOCUMENTO_MOD[formModificar.tipoDocumento]}
              value={formModificar.numeroDocumento}
              onChange={(e) => actualizarFormModificar('numeroDocumento', e.target.value.replace(/\D/g, ''))}
            />

            <CampoTexto
              etiqueta="Razón social"
              type="text"
              value={formModificar.razonSocial}
              onChange={(e) => actualizarFormModificar('razonSocial', e.target.value)}
            />

            <CampoTexto
              etiqueta="Teléfono (opcional)"
              type="tel"
              value={formModificar.telefono}
              onChange={(e) => actualizarFormModificar('telefono', e.target.value)}
            />

            {/* TDSI-908 / 914: dato actual y dato nuevo lado a lado, antes del PIN */}
            {/* TDSI-904: "actual" sale de lo guardado en la BD (resumen.datos_actuales); la fila
                de la tabla puede estar desactualizada si la factura se modifico despues de cargarla */}
            <ComparacionModificacion
              actual={{
                tipoDocumento: (resumen?.datos_actuales ?? facturaParaModificar).tipo_documento || 'NIT',
                numeroDocumento: (resumen?.datos_actuales ?? facturaParaModificar).nit || '',
                razonSocial: (resumen?.datos_actuales ?? facturaParaModificar).razon_social || '',
                telefono: (resumen?.datos_actuales ?? facturaParaModificar).telefono || '',
              }}
              nuevo={formModificar}
            />

            <CampoTexto
              etiqueta="Usuario del supervisor"
              type="text"
              autoComplete="off"
              value={credencialesModificar.supervisor_id}
              onChange={(e) => actualizarCredencialModificar('supervisor_id', e.target.value)}
            />

            <label className="ui-campo">
              <span className="ui-campo-etiqueta">PIN</span>
              <span className="ui-control">
                <CampoPassword
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={credencialesModificar.pin}
                  onChange={(e) => actualizarCredencialModificar('pin', e.target.value)}
                />
              </span>
            </label>

            {errorModificar && <Alerta tono="error" titulo={errorModificar} />}

            <div className="ui-modal-acciones">
              <Boton variante="contorno" onClick={cerrarModificar} disabled={modificando}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={modificando || !tiempoRestante}>
                {modificando ? 'Guardando...' : 'Guardar cambios'}
              </Boton>
            </div>
          </form>
        )}
      </Modal>

      {/* TDSI-49: facturas anuladas del turno abierto de la caja de este cajero. */}
      <Modal ancho abierto={mostrandoAnuladasTurno} titulo="Anuladas en el turno" onCerrar={cerrarAnuladasTurno}>
        {cargandoAnuladasTurno && <EstadoCargando texto="Cargando..." />}

        {!cargandoAnuladasTurno && errorAnuladasTurno && <Alerta tono="error" titulo={errorAnuladasTurno} />}

        {!cargandoAnuladasTurno &&
          !errorAnuladasTurno &&
          anuladasTurno &&
          (anuladasTurno.anuladas.length === 0 ? (
            <p className="fac-nota">Todavía no anulaste ninguna factura en este turno.</p>
          ) : (
            <Tabla etiqueta="Anuladas en el turno">
              <thead>
                <tr>
                  <th>N° Factura</th>
                  <th>Hora</th>
                  <th className="ui-num">Total (Bs.)</th>
                  <th>Motivo</th>
                  <th>Supervisor</th>
                </tr>
              </thead>
              <tbody>
                {anuladasTurno.anuladas.map((a) => (
                  <tr key={a.numero_factura}>
                    <td>{a.numero_factura}</td>
                    <td>{new Date(a.hora).toLocaleTimeString()}</td>
                    <td className="ui-num">{a.total.toFixed(2)}</td>
                    <td>{a.motivo || '—'}</td>
                    <td>{a.supervisor || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>Total anulado</strong>
                  </td>
                  <td className="ui-num">
                    <strong>{anuladasTurno.montoAnulado.toFixed(2)}</strong>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </Tabla>
          ))}
      </Modal>
    </section>
  )
}

export default Facturas
