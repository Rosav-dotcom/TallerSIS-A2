import { useEffect, useState } from 'react'
import { registrarPago, registrarPagoMixto, calcularPagoMixto, registrarVentaCancelada, contarVentasCanceladas, consultarPosibleDuplicado, obtenerTipoCambio, enviarFacturaPorCorreo, buscarClientePorDocumento } from '../api/pagos.js'
import { calcularVuelto, calcularCobroUsd, crearCobroQr, consultarEstadoCobroQr, confirmarCobroQr } from '../api/cobros.js'
import PagoMixtoForm from '../components/PagoMixtoForm.jsx'
import CancelarVentaModal from '../components/CancelarVentaModal.jsx'
import MisRespuestasRapidas from '../components/MisRespuestasRapidas.jsx'
import AvisoCobroDuplicadoModal from '../components/AvisoCobroDuplicadoModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'

import { EFECTIVO_USD, ESTADO_INICIAL, MENSAJE_FORMATO_DOCUMENTO, MENSAJE_MONTO_INSUFICIENTE, REGEX_DOCUMENTO } from './pagos/constantes.js'
import { buscarCobroAnterior, hoyLocal, leyendaPagadoEnUsd, validarFormulario } from './pagos/utilidades.js'
import EncabezadoPagos from './pagos/EncabezadoPagos.jsx'
import SeccionMetodoPago from './pagos/SeccionMetodoPago.jsx'
import CobroEfectivo from './pagos/CobroEfectivo.jsx'
import CobroUsd from './pagos/CobroUsd.jsx'
import DatosFacturacion from './pagos/DatosFacturacion.jsx'
import EnvioCorreo from './pagos/EnvioCorreo.jsx'
import ResumenCobro from './pagos/ResumenCobro.jsx'
import CobroQrEspera from './pagos/CobroQrEspera.jsx'
import PagoRegistrado from './pagos/PagoRegistrado.jsx'

// TDSI-29: pantalla de cobro. El estado y la lógica del cobro viven aquí; cada parte de la
// pantalla está en src/pages/pagos/ y solo dibuja lo que recibe (patch 0009 de la migración).
function Pagos() {
  const { cajero } = useAuth()

  // TDSI-45: cancelar una venta que todavia no se cobro.
  const [mostrarCancelarVenta, setMostrarCancelarVenta] = useState(false)
  const [mensajeCancelacion, setMensajeCancelacion] = useState(null)
  const [canceladasHoy, setCanceladasHoy] = useState(null)
  const [mostrarRespuestasRapidas, setMostrarRespuestasRapidas] = useState(false) // TDSI-44
  const [datos, setDatos] = useState(ESTADO_INICIAL)
  const [paso, setPaso] = useState('formulario')
  const [errorValidacion, setErrorValidacion] = useState(null)
  const [errorApi, setErrorApi] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [pagoRegistrado, setPagoRegistrado] = useState(null)
  const [envioFactura, setEnvioFactura] = useState(null) // { ok, mensaje } | null
  const [enviandoFactura, setEnviandoFactura] = useState(false)
  const [cobroQr, setCobroQr] = useState(null) // { id, referencia, monto, estado, expira_en } | null
  const [segundosRestantes, setSegundosRestantes] = useState(null)

  // TDSI-29: vuelto calculado por el backend (endpoint dedicado), en vivo mientras se escribe.
  const [vuelto, setVuelto] = useState(null)
  const [desgloseVuelto, setDesgloseVuelto] = useState([]) // TDSI-160: [{ denominacion, cantidad }]
  const [errorVuelto, setErrorVuelto] = useState(null)
  const [calculandoVuelto, setCalculandoVuelto] = useState(false)

  // TDSI-43: aviso de posible cobro repetido.
  const [avisoDuplicado, setAvisoDuplicado] = useState(null) // { factura, segundos, anterior } | null
  // En QR la venta se registra despues de generar el QR, asi que la decision se guarda hasta entonces.
  const [cobroDuplicado, setCobroDuplicado] = useState(false)

  // TDSI-42: cobro en dolares. La conversion y el vuelto los calcula el backend.
  const [tipoCambio, setTipoCambio] = useState(null)
  const [errorTipoCambio, setErrorTipoCambio] = useState(null)
  const [intentoTipoCambio, setIntentoTipoCambio] = useState(0)
  const [cobroUsd, setCobroUsd] = useState(null) // { dolaresRecibidos, tipoCambio, equivalenteBs, vuelto }
  const [faltanteBs, setFaltanteBs] = useState(null)
  const [errorCobroUsd, setErrorCobroUsd] = useState(null)
  const [calculandoCobroUsd, setCalculandoCobroUsd] = useState(false)

  const esMixto = datos.metodos.length === 2
  const esQrSimple = datos.metodos.length === 1 && datos.metodos[0] === 'QR'
  const mostrarPanelMixto = esMixto && paso === 'formulario'
  const esEfectivoSimple = datos.metodos.length === 1 && datos.metodos[0] === 'Efectivo'
  const esEfectivoUsd = datos.metodos[0] === EFECTIVO_USD
  // TDSI-818: sin un calculo valido del backend no se puede seguir con el cobro.
  const cobroUsdBloqueado = esEfectivoUsd && (calculandoCobroUsd || faltanteBs !== null || errorCobroUsd !== null)
  const tipoCambioVigente = cobroUsd?.tipoCambio ?? tipoCambio
  const esMixtoConEfectivo = esMixto && datos.metodos.includes('Efectivo')

  // TDSI-39/532: mientras se espera el pago, se consulta el estado cada 4s
  // (el backend es quien decide si ya expiro o si se confirmo).
  useEffect(() => {
    if (paso !== 'esperando-qr' || !cobroQr || cobroQr.estado !== 'Pendiente') {
      return
    }
    const intervalo = setInterval(async () => {
      try {
        const actualizado = await consultarEstadoCobroQr(cobroQr.id)
        setCobroQr(actualizado)
      } catch {
        // Si falla la consulta (p.ej. problema de red) se reintenta en el siguiente ciclo.
      }
    }, 4000)
    return () => clearInterval(intervalo)
  }, [paso, cobroQr?.id, cobroQr?.estado])

  // TDSI-39/533: cuenta regresiva en pantalla hasta que expira el QR (solo visual;
  // la autoridad sobre si expiro o no la tiene el backend, via el polling de arriba).
  useEffect(() => {
    if (!cobroQr || cobroQr.estado !== 'Pendiente') {
      setSegundosRestantes(null)
      return
    }
    function recalcular() {
      setSegundosRestantes(Math.max(0, Math.round((new Date(cobroQr.expira_en).getTime() - Date.now()) / 1000)))
    }
    recalcular()
    const intervalo = setInterval(recalcular, 1000)
    return () => clearInterval(intervalo)
  }, [cobroQr?.expira_en, cobroQr?.estado])

  function actualizarCampo(campo, valor) {
    setMensajeCancelacion(null)
    setDatos((prev) => ({ ...prev, [campo]: valor }))
  }

  // TDSI-844: contador "Canceladas hoy". Si no se puede consultar, simplemente no se muestra.
  async function actualizarCanceladasHoy() {
    if (!cajero?.nombre) return
    try {
      const { data } = await contarVentasCanceladas(cajero.nombre, hoyLocal())
      setCanceladasHoy(data.total)
    } catch {
      setCanceladasHoy(null)
    }
  }

  useEffect(() => {
    actualizarCanceladasHoy()
  }, [cajero?.nombre])

  // TDSI-843/845: registra la cancelacion, deja la pantalla limpia y avisa.
  // Si falla, el error se muestra en el modal (que sigue abierto).
  async function confirmarCancelacion({ motivo, motivo_texto }) {
    const total = Number(datos.monto)
    await registrarVentaCancelada({
      cajero_id: cajero?.nombre,
      caja_id: cajero?.caja,
      // La pantalla de Pagos no tiene items de producto (no hay catalogo): se registra lo que
      // se cargo, que es el monto de la venta.
      items: [{ descripcion: 'Monto de la venta', monto: total }],
      total,
      motivo,
      motivo_texto,
    })
    setMostrarCancelarVenta(false)
    registrarOtro()
    setErrorValidacion(null)
    setErrorApi(null)
    setMensajeCancelacion(`Venta cancelada (Bs. ${total.toFixed(2)}). Motivo: ${motivo_texto || motivo}.`)
    actualizarCanceladasHoy()
  }

  // TDSI-29/571: apenas hay total + monto recibido validos, se consulta el
  // vuelto al backend (nunca se calcula "de mentira" solo en el navegador).
  // TDSI-791/793: se recalcula con cada cambio; en pago mixto, solo si los montos ya cuadran
  // con el total (el backend rechaza el calculo si no).
  useEffect(() => {
    const total = Number(datos.monto)
    const montoRecibido = Number(datos.montoRecibido)
    const montoMixto1 = Number(datos.montoMixto1)
    const montoMixto2 = Number(datos.montoMixto2)
    const mixtoCuadra =
      esMixtoConEfectivo &&
      montoMixto1 > 0 &&
      montoMixto2 > 0 &&
      Math.round((montoMixto1 + montoMixto2) * 100) === Math.round(total * 100)

    if (!(esEfectivoSimple || mixtoCuadra) || !(total > 0) || !(montoRecibido > 0)) {
      setVuelto(null)
      setDesgloseVuelto([])
      setErrorVuelto(null)
      setCalculandoVuelto(false)
      return
    }

    let cancelado = false
    setCalculandoVuelto(true)
    const timeout = setTimeout(async () => {
      try {
        const { data } = esEfectivoSimple
          ? await calcularVuelto(total, montoRecibido)
          : await calcularPagoMixto({
              total,
              metodos: [
                { metodo: datos.metodos[0], monto: montoMixto1 },
                { metodo: datos.metodos[1], monto: montoMixto2 },
              ],
              efectivoRecibido: montoRecibido,
            })
        if (!cancelado) {
          setVuelto(esEfectivoSimple ? data.vuelto : data.cambio)
          setDesgloseVuelto(esEfectivoSimple ? data.desglose : data.desgloseVuelto)
          setErrorVuelto(null)
          // TDSI-573: el monto ya alcanza, asi que el aviso de "insuficiente" deja de aplicar
          setErrorValidacion((actual) => (actual === MENSAJE_MONTO_INSUFICIENTE ? null : actual))
        }
      } catch (err) {
        if (!cancelado) {
          setVuelto(null)
          setDesgloseVuelto([])
          setErrorVuelto(err.message)
        }
      } finally {
        if (!cancelado) setCalculandoVuelto(false)
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timeout)
    }
  }, [esEfectivoSimple, esMixtoConEfectivo, datos.metodos, datos.monto, datos.montoRecibido, datos.montoMixto1, datos.montoMixto2])

  // TDSI-816: el tipo de cambio se consulta cada vez que se elige "Efectivo en dólares".
  useEffect(() => {
    if (!esEfectivoUsd) {
      setTipoCambio(null)
      setErrorTipoCambio(null)
      return
    }
    let cancelado = false
    setErrorTipoCambio(null)
    obtenerTipoCambio()
      .then((r) => {
        if (!cancelado) setTipoCambio(r.data.valor)
      })
      .catch((err) => {
        if (!cancelado) setErrorTipoCambio(err.message)
      })
    return () => {
      cancelado = true
    }
  }, [esEfectivoUsd, intentoTipoCambio])

  // TDSI-817/818: equivalente en Bs y vuelto en vivo mientras se escriben los dolares.
  useEffect(() => {
    const total = Number(datos.monto)
    const dolaresRecibidos = Number(datos.dolaresRecibidos)
    setCobroUsd(null)
    setFaltanteBs(null)
    setErrorCobroUsd(null)

    if (!esEfectivoUsd || !(total > 0) || !(dolaresRecibidos > 0)) {
      setCalculandoCobroUsd(false)
      return
    }

    let cancelado = false
    setCalculandoCobroUsd(true)
    const timeout = setTimeout(async () => {
      try {
        const r = await calcularCobroUsd(total, dolaresRecibidos)
        if (!cancelado) setCobroUsd(r.data)
      } catch (err) {
        if (cancelado) return
        if (err.detalle?.faltanteBs != null) {
          setFaltanteBs(err.detalle.faltanteBs)
        } else {
          setErrorCobroUsd(err.message)
        }
      } finally {
        if (!cancelado) setCalculandoCobroUsd(false)
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timeout)
    }
  }, [esEfectivoUsd, datos.monto, datos.dolaresRecibidos])

  // TDSI-29/572: cada click suma ese billete al monto recibido (se puede combinar varios).
  function agregarBillete(valor) {
    setDatos((prev) => ({ ...prev, montoRecibido: String((Number(prev.montoRecibido) || 0) + valor) }))
  }

  function elegirTipoDocumento(tipoDocumento) {
    setDatos((prev) => ({
      ...prev,
      tipoDocumento,
      numeroDocumento: tipoDocumento === 'NINGUNO' ? '' : prev.numeroDocumento,
      razonSocial: tipoDocumento === 'NINGUNO' ? '' : prev.razonSocial,
    }))
  }

  // Si ese NIT/CI ya se uso en un pago anterior, se autocompleta la razon social
  // (el cajero puede seguir editandola a mano si hace falta corregirla).
  async function alPerderFocoDocumento() {
    const tipoDocumento = datos.tipoDocumento
    const numero = datos.numeroDocumento.trim()
    if (tipoDocumento === 'NINGUNO' || !REGEX_DOCUMENTO[tipoDocumento].test(numero)) {
      return
    }
    try {
      const respuesta = await buscarClientePorDocumento(tipoDocumento, numero)
      if (respuesta.data?.razon_social) {
        actualizarCampo('razonSocial', respuesta.data.razon_social)
      }
    } catch {
      // Si falla la busqueda, el cajero simplemente escribe la razon social a mano.
    }
  }

  // Se puede elegir hasta 2 métodos para un pago mixto, pero Tarjeta + QR no es
  // una combinación válida: un pago mixto siempre debe incluir Efectivo. Al cambiar
  // la combinación se limpian los montos del pago mixto (ya no corresponden).
  function toggleMetodo(id) {
    const actuales = datos.metodos

    if (actuales.includes(id)) {
      setErrorValidacion(null)
      setDatos((prev) => ({ ...prev, metodos: prev.metodos.filter((m) => m !== id), montoMixto1: '', montoMixto2: '', montoRecibido: '', dolaresRecibidos: '' }))
      return
    }

    if (actuales.length === 2) {
      return
    }

    if (actuales.length === 1) {
      const combinacion = [...actuales, id]
      // El pago mixto del backend solo acepta Efectivo, Tarjeta y QR, en bolivianos.
      if (combinacion.includes(EFECTIVO_USD)) {
        setErrorValidacion('El cobro en dólares no se puede combinar con otro método de pago.')
        return
      }
      if (combinacion.includes('Tarjeta') && combinacion.includes('QR')) {
        setErrorValidacion('No puede combinar Tarjeta y QR. Un pago con 2 métodos debe incluir Efectivo.')
        return
      }
    }

    setErrorValidacion(null)
    setDatos((prev) => ({ ...prev, metodos: [...prev.metodos, id], montoMixto1: '', montoMixto2: '', montoRecibido: '', dolaresRecibidos: '' }))
  }

  function continuar(event) {
    event.preventDefault()
    if (cobroUsdBloqueado) return
    const mensaje = validarFormulario(datos)
    if (mensaje) {
      // El formato del NIT/CI ya se avisa abajo del propio campo: no repetirlo aquí.
      const esFormatoDocumento = datos.tipoDocumento !== 'NINGUNO' && mensaje === MENSAJE_FORMATO_DOCUMENTO[datos.tipoDocumento]
      setErrorValidacion(esFormatoDocumento ? null : mensaje)
      return
    }
    setErrorValidacion(null)
    setPaso('confirmacion')
  }

  function cambiarMetodo() {
    setErrorApi(null)
    setPaso('formulario')
  }

  function construirDatosFacturacion() {
    const datosFacturacion = {}
    if (datos.tipoDocumento !== 'NINGUNO') {
      datosFacturacion.tipo_documento = datos.tipoDocumento
      datosFacturacion.nit = datos.numeroDocumento.trim()
      datosFacturacion.razon_social = datos.razonSocial.trim()
    }
    if (datos.telefono.trim()) {
      datosFacturacion.telefono = datos.telefono.trim()
    }
    if (datos.enviarCorreo) {
      datosFacturacion.email = datos.email.trim()
    }
    return datosFacturacion
  }

  // El correo ya se pidió en el formulario: se envía solo, sin volver a preguntar.
  async function enviarFacturaSiCorresponde(idTransaccion) {
    if (!datos.enviarCorreo || !datos.email.trim()) {
      return
    }
    setEnviandoFactura(true)
    try {
      const r = await enviarFacturaPorCorreo(idTransaccion, datos.email.trim())
      setEnvioFactura({ ok: true, mensaje: r.mensaje })
    } catch (err) {
      setEnvioFactura({ ok: false, mensaje: err.message })
    } finally {
      setEnviandoFactura(false)
    }
  }

  // TDSI-164: antes de registrar se revisa si esta venta repite un cobro reciente. Sin NIT/CI no
  // hay cliente con el cual comparar. Si la consulta falla, no se traba la venta: es solo un aviso.
  async function confirmarCobro() {
    setErrorApi(null)
    setCobroDuplicado(false)

    if (datos.tipoDocumento !== 'NINGUNO') {
      setEnviando(true)
      try {
        const { data } = await consultarPosibleDuplicado({
          cajero_id: cajero?.nombre,
          nit: datos.numeroDocumento.trim(),
          total: Number(datos.monto),
        })
        if (data.esDuplicado) {
          const anterior = await buscarCobroAnterior(cajero?.nombre, data.factura).catch(() => null)
          setAvisoDuplicado({ factura: data.factura, segundos: data.segundos, anterior })
          return
        }
      } catch {
        // Se sigue con el cobro normal.
      } finally {
        setEnviando(false)
      }
    }

    await ejecutarCobro(false)
  }

  // TDSI-830: "Cobrar igual" registra el cobro normalmente y deja constancia de la decision.
  async function cobrarIgual() {
    setAvisoDuplicado(null)
    setCobroDuplicado(true)
    await ejecutarCobro(true)
  }

  async function ejecutarCobro(esCobroDuplicado) {
    // El QR no se registra como venta todavia: primero hay que generarlo y
    // esperar a que el cajero confirme que vio llegar el pago (ver abajo).
    if (esQrSimple) {
      await generarCobroQr()
      return
    }

    setEnviando(true)
    setErrorApi(null)
    const datosFacturacion = construirDatosFacturacion()
    if (esCobroDuplicado) {
      datosFacturacion.cobro_duplicado = true
    }

    try {
      let idTransaccionRegistrada

      if (esMixto) {
        const payload = {
          ...datosFacturacion,
          total: Number(datos.monto),
          metodos: [
            { metodo: datos.metodos[0], monto: Number(datos.montoMixto1) },
            { metodo: datos.metodos[1], monto: Number(datos.montoMixto2) },
          ],
          cajaId: cajero?.caja,
          cajero: cajero?.nombre,
          // TDSI-61/200: nombre para "Atendido por" en la tirilla/PDF -- hoy es el
          // email con el que inicio sesion (todavia no hay un nombre de pila separado).
          cajero_nombre: cajero?.nombre,
        }
        const respuesta = await registrarPagoMixto(payload)
        idTransaccionRegistrada = respuesta.data.pago.id_transaccion
        setPagoRegistrado({
          id_transaccion: respuesta.data.pago.id_transaccion,
          monto: respuesta.data.pago.total,
          estado: respuesta.data.pago.estado,
          fecha: respuesta.data.pago.fecha,
          detalle: respuesta.data.detalle,
        })
      } else {
        const payload = {
          ...datosFacturacion,
          metodo: esEfectivoUsd ? 'Efectivo' : datos.metodos[0],
          monto: Number(datos.monto),
          caja_id: cajero?.caja,
          cajero: cajero?.nombre,
          cajero_nombre: cajero?.nombre,
        }
        if (esEfectivoSimple && datos.montoRecibido) {
          payload.monto_recibido = Number(datos.montoRecibido)
        }
        // TDSI-813: la venta sigue en Bs (el backend recalcula el vuelto con monto_recibido);
        // la moneda, el monto en USD y el T.C. son los datos de la leyenda de la factura.
        if (esEfectivoUsd) {
          payload.monto_recibido = cobroUsd.equivalenteBs
          payload.moneda_recibida = 'USD'
          payload.monto_usd = cobroUsd.dolaresRecibidos
          payload.tipo_cambio = cobroUsd.tipoCambio
        }
        const respuesta = await registrarPago(payload)
        idTransaccionRegistrada = respuesta.pago.id_transaccion
        setPagoRegistrado({
          ...respuesta.pago,
          detalle: null,
          leyendaUsd: esEfectivoUsd ? leyendaPagadoEnUsd(cobroUsd.dolaresRecibidos, cobroUsd.tipoCambio) : null,
        })
      }

      setPaso('listo')
      await enviarFacturaSiCorresponde(idTransaccionRegistrada)
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  // TDSI-39/531: crea el cobro pendiente que se muestra junto al QR fijo de la
  // cuenta (se usa tanto para generarlo la primera vez como para "Regenerar QR").
  async function generarCobroQr() {
    setEnviando(true)
    setErrorApi(null)
    try {
      const cobro = await crearCobroQr({ monto: Number(datos.monto), caja_id: cajero?.caja, cajero: cajero?.nombre })
      setCobroQr(cobro)
      setPaso('esperando-qr')
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  async function registrarVentaQr() {
    const payload = {
      ...construirDatosFacturacion(),
      metodo: 'QR',
      monto: Number(datos.monto),
      caja_id: cajero?.caja,
      cajero: cajero?.nombre,
      cajero_nombre: cajero?.nombre,
      ...(cobroDuplicado && { cobro_duplicado: true }),
    }
    const respuesta = await registrarPago(payload)
    setPagoRegistrado({ ...respuesta.pago, detalle: null })
    setPaso('listo')
    await enviarFacturaSiCorresponde(respuesta.pago.id_transaccion)
  }

  // TDSI-39/533: el cajero confirma a mano que vio llegar el deposito. Recien
  // ahi se registra la venta real (factura, correo, PDF), igual que cualquier
  // otro metodo de pago.
  async function confirmarPagoQrRecibido() {
    setEnviando(true)
    setErrorApi(null)
    try {
      await confirmarCobroQr(cobroQr.id, cajero?.nombre)
      await registrarVentaQr()
    } catch (err) {
      setErrorApi(err.message)
      // Si el error fue porque el QR ya expiro (o porque el cobro quedo
      // confirmado pero el registro de la venta falló a mitad de camino),
      // se refresca el estado para que la pantalla ofrezca la accion correcta.
      try {
        setCobroQr(await consultarEstadoCobroQr(cobroQr.id))
      } catch {
        // Si tampoco se puede consultar el estado, se deja el error de arriba.
      }
    } finally {
      setEnviando(false)
    }
  }

  // Cubre el caso en que el cobro ya quedo "Pagado" en el servidor pero el
  // registro de la venta fallo (p.ej. corte de red): no hay que volver a
  // confirmar el cobro (ya esta confirmado), solo reintentar la venta.
  async function reintentarRegistroVentaQr() {
    setEnviando(true)
    setErrorApi(null)
    try {
      await registrarVentaQr()
    } catch (err) {
      setErrorApi(err.message)
    } finally {
      setEnviando(false)
    }
  }

  function cancelarCobroQr() {
    setCobroQr(null)
    setErrorApi(null)
    setPaso('confirmacion')
  }

  function registrarOtro() {
    setDatos(ESTADO_INICIAL)
    setPagoRegistrado(null)
    setEnvioFactura(null)
    setCobroQr(null)
    setPaso('formulario')
  }

  return (
    <section>
      <EncabezadoPagos canceladasHoy={canceladasHoy} onAbrirRespuestas={() => setMostrarRespuestasRapidas(true)} />

      {mensajeCancelacion && <p className="mensaje-exito pagos-mensaje">{mensajeCancelacion}</p>}

      {mostrarCancelarVenta && (
        <CancelarVentaModal
          total={Number(datos.monto)}
          cajeroId={cajero?.nombre}
          onConfirmar={confirmarCancelacion}
          onVolver={() => setMostrarCancelarVenta(false)}
        />
      )}

      {mostrarRespuestasRapidas && (
        <MisRespuestasRapidas cajeroId={cajero?.nombre} onCerrar={() => setMostrarRespuestasRapidas(false)} />
      )}

      <div className={`pagos-layout${mostrarPanelMixto ? ' pagos-layout--dividido' : ''}`}>
        <div className="pagos-layout-col">
          {paso === 'formulario' && (
            <form className="pago-form" onSubmit={continuar}>
              {/* El ID de transacción ya no lo escribe el cajero: lo genera el sistema al confirmar el cobro. */}
              <label className="campo">
                Monto (Bs.)
                <input type="number" step="0.01" value={datos.monto} onChange={(e) => actualizarCampo('monto', e.target.value)} />
              </label>

              <SeccionMetodoPago metodos={datos.metodos} esMixto={esMixto} onToggleMetodo={toggleMetodo} />

              {esEfectivoSimple && (
                <CobroEfectivo
                  montoRecibido={datos.montoRecibido}
                  onCambiarMontoRecibido={(valor) => actualizarCampo('montoRecibido', valor)}
                  onAgregarBillete={agregarBillete}
                  calculandoVuelto={calculandoVuelto}
                  errorVuelto={errorVuelto}
                  errorValidacion={errorValidacion}
                  vuelto={vuelto}
                  desgloseVuelto={desgloseVuelto}
                />
              )}

              {esEfectivoUsd && (
                <CobroUsd
                  errorTipoCambio={errorTipoCambio}
                  onReintentarTipoCambio={() => setIntentoTipoCambio((n) => n + 1)}
                  tipoCambioVigente={tipoCambioVigente}
                  monto={datos.monto}
                  dolaresRecibidos={datos.dolaresRecibidos}
                  onCambiarDolares={(valor) => {
                    setErrorValidacion(null)
                    actualizarCampo('dolaresRecibidos', valor)
                  }}
                  calculandoCobroUsd={calculandoCobroUsd}
                  errorCobroUsd={errorCobroUsd}
                  faltanteBs={faltanteBs}
                  cobroUsd={cobroUsd}
                />
              )}

              <DatosFacturacion
                tipoDocumento={datos.tipoDocumento}
                numeroDocumento={datos.numeroDocumento}
                razonSocial={datos.razonSocial}
                telefono={datos.telefono}
                onElegirTipoDocumento={elegirTipoDocumento}
                onCambiarCampo={actualizarCampo}
                onSalirDocumento={alPerderFocoDocumento}
              />

              <EnvioCorreo enviarCorreo={datos.enviarCorreo} email={datos.email} onCambiarCampo={actualizarCampo} />

              {errorValidacion && <p className="error">{errorValidacion}</p>}

              <div className="pago-acciones">
                <button type="submit" className="btn" disabled={cobroUsdBloqueado}>
                  Continuar
                </button>
                <button
                  type="button"
                  className="btn btn-secundario"
                  onClick={() => setMostrarCancelarVenta(true)}
                  disabled={!(Number(datos.monto) > 0)}
                >
                  Cancelar venta
                </button>
              </div>
            </form>
          )}

          {paso === 'confirmacion' && (
            <ResumenCobro
              datos={datos}
              esMixto={esMixto}
              esEfectivoUsd={esEfectivoUsd}
              cobroUsd={cobroUsd}
              esEfectivoSimple={esEfectivoSimple}
              esMixtoConEfectivo={esMixtoConEfectivo}
              vuelto={vuelto}
              calculandoVuelto={calculandoVuelto}
              desgloseVuelto={desgloseVuelto}
              errorApi={errorApi}
              enviando={enviando}
              esQrSimple={esQrSimple}
              onEditar={cambiarMetodo}
              onConfirmar={confirmarCobro}
              onCancelarVenta={() => setMostrarCancelarVenta(true)}
            />
          )}

          {paso === 'esperando-qr' && cobroQr && (
            <CobroQrEspera
              cobroQr={cobroQr}
              segundosRestantes={segundosRestantes}
              errorApi={errorApi}
              enviando={enviando}
              onCancelar={cancelarCobroQr}
              onConfirmarPagoRecibido={confirmarPagoQrRecibido}
              onReintentarRegistro={reintentarRegistroVentaQr}
              onRegenerarQr={generarCobroQr}
            />
          )}

          {paso === 'listo' && pagoRegistrado && (
            <PagoRegistrado
              pagoRegistrado={pagoRegistrado}
              enviarCorreo={datos.enviarCorreo}
              enviandoFactura={enviandoFactura}
              envioFactura={envioFactura}
              onRegistrarOtro={registrarOtro}
            />
          )}
        </div>

        {mostrarPanelMixto && (
          <div className="pagos-layout-col">
            <PagoMixtoForm
              totalVenta={Number(datos.monto) || 0}
              metodo1={datos.metodos[0]}
              metodo2={datos.metodos[1]}
              monto1={datos.montoMixto1}
              monto2={datos.montoMixto2}
              onCambiarMonto1={(valor) => actualizarCampo('montoMixto1', valor)}
              onCambiarMonto2={(valor) => actualizarCampo('montoMixto2', valor)}
              montoRecibido={datos.montoRecibido}
              onCambiarMontoRecibido={(valor) => actualizarCampo('montoRecibido', valor)}
              vuelto={vuelto}
              desgloseVuelto={desgloseVuelto}
              calculandoVuelto={calculandoVuelto}
              errorVuelto={errorVuelto}
            />
          </div>
        )}
      </div>

      {avisoDuplicado && (
        <AvisoCobroDuplicadoModal
          factura={avisoDuplicado.factura}
          segundos={avisoDuplicado.segundos}
          anterior={avisoDuplicado.anterior}
          actual={{ total: Number(datos.monto), metodos: datos.metodos, razonSocial: datos.razonSocial.trim() }}
          onCancelar={() => setAvisoDuplicado(null)}
          onCobrarIgual={cobrarIgual}
        />
      )}
    </section>
  )
}

export default Pagos
