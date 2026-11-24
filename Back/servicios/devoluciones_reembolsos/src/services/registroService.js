const { AppError } = require("../utils/AppError");
const devolucionesRepo = require("../data/devolucionesRepo");
const motivosRepo = require("../data/motivosRepo");
const { facturaDisponible } = require("./comprobantesService");
const { plazoDeComprobante } = require("./plazoService");
const { aDetalle } = require("./devolucionesService");
const { CODIGOS: OPCIONES_REEMBOLSO, opcionesDeFactura } = require("./opcionesReembolsoService");
const { obtenerLimiteAutorizacion } = require("./configuracionService");
const facturacion = require("../clients/facturacionClient");

// TDSI-70/1001: registro de una devolucion total o parcial eligiendo items y cantidades.
const MAS_DE_LO_COMPRADO = "No se puede devolver más unidades de las compradas";
const CONDICIONES = ["REINGRESO", "MERMA"];
const MAX_ITEMS = 200;
// TDSI-71/1009: textos de la PA y de la pantalla (paso 3 "Motivo")
const SIN_MOTIVO = "Seleccione un motivo";
const MAX_OBSERVACIONES = 300;
// TDSI-80/237: texto de la alerta de la pantalla
const REQUIERE_AUTORIZACION = "Requiere autorización del Supervisor";
const SIN_USUARIO = "Indique quién registra la devolución (creado_por): el usuario con que inició sesión.";
const SIN_OPCION = "Elija cómo se devuelve el dinero (Efectivo, Reversión electrónica o Vale).";

// Montos y cantidades en enteros (centavos / centesimas) para no arrastrar errores de coma flotante.
const aCentesimas = (v) => Math.round(Number(v) * 100);
const aNumero = (centesimas) => centesimas / 100;

/** Valida la forma del pedido (sin mirar la factura todavia). */
function validarPedido(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new AppError("El cuerpo debe ser un objeto JSON.", 400);
  }
  const facturaNumero = typeof body.factura_numero === "string" ? body.factura_numero.trim().toUpperCase() : "";
  if (!facturaNumero) throw new AppError("Indique el N.º de factura del comprobante (factura_numero).", 400);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new AppError("Elija al menos un ítem para devolver.", 400);
  }
  if (body.items.length > MAX_ITEMS) throw new AppError(`No se pueden devolver más de ${MAX_ITEMS} ítems a la vez.`, 400);

  const vistos = new Set();
  const items = body.items.map((it, i) => {
    const itemId = Number(it?.item_id);
    if (!Number.isSafeInteger(itemId) || itemId < 1) {
      throw new AppError(`El ítem ${i + 1} debe indicar su item_id (el ítem del comprobante).`, 400);
    }
    if (vistos.has(itemId)) throw new AppError(`El ítem ${itemId} está repetido.`, 400, { item_id: itemId });
    vistos.add(itemId);

    const cantidad = Number(it.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || Math.abs(cantidad * 100 - Math.round(cantidad * 100)) > 1e-6) {
      throw new AppError("La cantidad a devolver debe ser mayor a 0 (hasta 2 decimales).", 400, { item_id: itemId, cantidad: it.cantidad });
    }
    const condicion = it.condicion === undefined || it.condicion === null ? "REINGRESO" : String(it.condicion).trim().toUpperCase();
    if (!CONDICIONES.includes(condicion)) {
      throw new AppError("La condición debe ser REINGRESO o MERMA.", 400, { item_id: itemId, condicion: it.condicion });
    }
    return { item_id: itemId, cantidad: aCentesimas(cantidad), condicion };
  });

  // TDSI-81/1057: quien registra queda en el historial (PA TDSI-1058: usuario y hora)
  const creadoPor = typeof body.creado_por === "string" ? body.creado_por.trim() : "";
  if (!creadoPor) throw new AppError(SIN_USUARIO, 400);
  if (creadoPor.length > 60) throw new AppError("El usuario (creado_por) admite hasta 60 caracteres.", 400);

  // TDSI-71/1103: motivo (id del catalogo, GET /api/devoluciones/motivos) y observaciones.
  // TDSI-71/1009: el motivo es obligatorio (PA TDSI-1010) y las observaciones, opcionales,
  // tienen hasta 300 caracteres (PA TDSI-1012).
  if (body.motivo_id === undefined || body.motivo_id === null || body.motivo_id === "") {
    throw new AppError(SIN_MOTIVO, 400);
  }
  const motivoId = Number(body.motivo_id);
  if (!Number.isSafeInteger(motivoId) || motivoId < 1) {
    throw new AppError("El motivo no es válido.", 400, { motivo_id: body.motivo_id });
  }
  let observaciones = null;
  if (body.observaciones !== undefined && body.observaciones !== null) {
    if (typeof body.observaciones !== "string") throw new AppError("Las observaciones deben ser texto.", 400);
    observaciones = body.observaciones.trim() || null;
    // por caracteres reales (un emoji o una letra con tilde cuentan 1), igual que VARCHAR(300) en la BD
    const largo = observaciones ? [...observaciones].length : 0;
    if (largo > MAX_OBSERVACIONES) {
      throw new AppError(`Las observaciones no pueden tener más de ${MAX_OBSERVACIONES} caracteres.`, 400, { largo });
    }
  }

  // TDSI-72/1106: como se devuelve el dinero (paso 4): EFECTIVO, REVERSION_TARJETA o VALE
  const opcion = typeof body.opcion_reembolso === "string" ? body.opcion_reembolso.trim().toUpperCase() : "";
  if (!opcion) throw new AppError(SIN_OPCION, 400);
  if (!OPCIONES_REEMBOLSO.includes(opcion)) {
    throw new AppError(`La opción de reembolso debe ser ${OPCIONES_REEMBOLSO.join(", ")}.`, 400, { opcion_reembolso: body.opcion_reembolso });
  }

  // TDSI-80/1085: { supervisor_id, pin } del supervisor que autoriza (solo hace falta sobre el limite)
  let autorizacion = null;
  if (body.autorizacion !== undefined && body.autorizacion !== null) {
    const a = body.autorizacion;
    if (typeof a !== "object" || Array.isArray(a)) throw new AppError("La autorización debe tener supervisor_id y pin.", 400);
    const supervisorId = typeof a.supervisor_id === "string" ? a.supervisor_id.trim() : "";
    if (!supervisorId) throw new AppError("Indique el usuario del supervisor que autoriza.", 400);
    autorizacion = { supervisor_id: supervisorId, pin: typeof a.pin === "string" ? a.pin : String(a.pin ?? "") };
  }

  // TDSI-80/1069: caja donde se atiende la devolucion (codigo de gestion_caja, p. ej. CAJA-01); opcional
  let cajaId = null;
  if (body.caja_id !== undefined && body.caja_id !== null && body.caja_id !== "") {
    cajaId = typeof body.caja_id === "string" ? body.caja_id.trim().toUpperCase() : "";
    if (!/^[A-Z0-9_-]{1,20}$/.test(cajaId)) {
      throw new AppError("La caja (caja_id) debe ser su código, por ejemplo CAJA-01.", 400, { caja_id: body.caja_id });
    }
  }
  return { facturaNumero, items, creadoPor, motivoId, observaciones, opcion, autorizacion, cajaId };
}

/**
 * Arma la devolucion contra la factura y lo ya devuelto (lo llama el repositorio dentro de
 * la transaccion, con la factura bloqueada).
 * - Cada item tiene que ser de esa factura y no pasar de lo comprado menos lo ya devuelto.
 * - TOTAL: devuelve todas las unidades de todos los items y nada se habia devuelto antes.
 *   Si no, PARCIAL (PA TDSI-1006 y TDSI-1007).
 * - Monto: suma de cantidad x precio unitario de lo devuelto. Si la factura tuvo descuento,
 *   se aplica en proporcion; una devolucion TOTAL devuelve exactamente el total de la factura.
 */
function construirDevolucion({ factura, pedido, plazo, yaDevuelto }) {
  const originales = new Map((factura.items || []).map((i) => [Number(i.id), i]));

  const items = pedido.items.map((p) => {
    const original = originales.get(p.item_id);
    if (!original) {
      throw new AppError(`El ítem ${p.item_id} no pertenece al comprobante ${factura.numero}.`, 400, { item_id: p.item_id });
    }
    const comprada = aCentesimas(original.cantidad);
    const devuelta = aCentesimas(yaDevuelto.get(p.item_id) || 0);
    const disponible = comprada - devuelta;
    if (p.cantidad > disponible) {
      throw new AppError(MAS_DE_LO_COMPRADO, 422, {
        item_id: p.item_id,
        descripcion: original.descripcion,
        comprada: aNumero(comprada),
        ya_devuelta: aNumero(devuelta),
        disponible: aNumero(disponible),
        pedida: aNumero(p.cantidad),
      });
    }
    const precio = aCentesimas(original.precio_unitario);
    return {
      factura_item_id: p.item_id,
      codigo_producto: original.codigo_producto ?? original.sku ?? null,
      descripcion: original.descripcion,
      cantidad: aNumero(p.cantidad),
      precio_unitario: aNumero(precio),
      subtotal: aNumero(Math.round((p.cantidad * precio) / 100)),
      condicion: p.condicion,
      _subtotalC: Math.round((p.cantidad * precio) / 100),
    };
  });

  const nadaDevueltoAntes = [...originales.keys()].every((id) => !(yaDevuelto.get(id) > 0));
  const devuelveTodo = [...originales.entries()].every(([id, o]) => {
    const pedido_ = pedido.items.find((p) => p.item_id === id);
    return pedido_ && pedido_.cantidad === aCentesimas(o.cantidad);
  });
  const tipo = nadaDevueltoAntes && devuelveTodo ? "TOTAL" : "PARCIAL";

  const sumaC = items.reduce((acc, it) => acc + it._subtotalC, 0);
  const subtotalFacturaC = aCentesimas(factura.subtotal);
  const totalFacturaC = aCentesimas(factura.total);
  let montoC = sumaC;
  if (tipo === "TOTAL") montoC = totalFacturaC;
  else if (subtotalFacturaC > 0 && totalFacturaC !== subtotalFacturaC) {
    montoC = Math.round((sumaC * totalFacturaC) / subtotalFacturaC);
  }
  if (montoC <= 0) throw new AppError("El monto a devolver debe ser mayor a 0.", 422);

  const metodos = (factura.metodosPago || []).map((m) => m.metodo).filter(Boolean);
  return {
    datos: {
      factura_numero: factura.numero,
      venta_id: factura.venta_id ?? null,
      cliente_nit: factura.cliente_nit ?? null,
      fecha_venta: factura.fecha,
      dentro_de_plazo: plazo.dentro_de_plazo,
      tipo,
      metodo_pago_original: (metodos.length ? metodos.join(" + ") : "No registrado").slice(0, 60),
      monto_total: aNumero(montoC),
      motivo_id: pedido.motivoId,
      opcion_reembolso: pedido.opcion,
      caja_id: pedido.cajaId,
      observaciones: pedido.observaciones,
      creado_por: pedido.creadoPor,
    },
    items: items.map(({ _subtotalC, ...it }) => it),
  };
}

/**
 * TDSI-80/237: una devolucion de MAS del limite (configuracion limite_autorizacion) necesita la
 * autorizacion de un supervisor; sin ella no se registra (403, PA TDSI-1054). Marca
 * requiere_autorizacion en la devolucion.
 * TDSI-80/1085: con { supervisor_id, pin } valida al supervisor en Facturacion (TDSI-55) y
 * guarda quien y cuando autorizo. PIN incorrecto: 401 "PIN invalido" (PA TDSI-1055) y no se
 * registra nada. Hasta el limite no se pide ni se valida el PIN.
 */
async function exigirAutorizacion(nueva, limite, autorizacion) {
  const monto = nueva.datos.monto_total;
  nueva.datos.requiere_autorizacion = monto > limite;
  if (!nueva.datos.requiere_autorizacion) return;
  if (!autorizacion) throw new AppError(REQUIERE_AUTORIZACION, 403, { monto_total: monto, limite });
  const supervisor = await facturacion.validarSupervisor(autorizacion);
  nueva.datos.autorizado_por = supervisor.supervisor_id;
  nueva.datos.autorizado_por_nombre = supervisor.nombre ?? null;
  nueva.datos.autorizado_en = new Date();
}

/**
 * POST /api/devoluciones -- TDSI-70/1001.
 * Cuerpo: { factura_numero, items: [{ item_id, cantidad, condicion? }], motivo_id,
 *          observaciones? (hasta 300), opcion_reembolso, creado_por, autorizacion? { supervisor_id, pin },
 *          caja_id? }
 * item_id es el de cada item del comprobante (GET /api/devoluciones/comprobantes/:numero).
 * El motivo (TDSI-71), la opcion de reembolso (TDSI-72) y la autorizacion del supervisor
 * (TDSI-80) se suman en sus historias.
 */
async function registrarDevolucion(body) {
  const pedido = validarPedido(body);

  // TDSI-71/1103: el motivo tiene que ser uno de los activos del catalogo
  const motivo = await motivosRepo.buscarActivo(pedido.motivoId);
  if (!motivo) throw new AppError("El motivo no es válido.", 400, { motivo_id: pedido.motivoId });

  // 404/409 si la factura no existe, esta anulada o tiene una anulacion pendiente (TDSI-68)
  const factura = await facturaDisponible(pedido.facturaNumero);
  if (!(factura.items || []).length) {
    throw new AppError("El comprobante no tiene ítems para devolver.", 422, { numero: factura.numero });
  }

  // TDSI-69: fuera de plazo no se registra (la pantalla ya bloquea "Continuar")
  const plazo = await plazoDeComprobante(factura.fecha);
  if (!plazo.dentro_de_plazo) {
    throw new AppError("La compra está fuera del plazo de devolución.", 422, {
      dias_transcurridos: plazo.dias_transcurridos, plazo_dias: plazo.plazo_dias, fecha_limite: plazo.fecha_limite,
    });
  }

  // TDSI-72/1106: la opcion tiene que estar habilitada para como se pago la compra (TDSI-1077);
  // si no, el mismo texto que la pantalla muestra en el tooltip.
  const reembolso = await opcionesDeFactura(factura);
  const elegida = reembolso.opciones.find((o) => o.codigo === pedido.opcion);
  if (!elegida.habilitada) {
    throw new AppError(elegida.explicacion, 422, { opcion_reembolso: pedido.opcion, metodo_pago: reembolso.metodo_pago });
  }

  // TDSI-80/237: el monto se conoce recien al armar la devolucion (dentro de la transaccion)
  const { limite } = await obtenerLimiteAutorizacion();

  const registrada = await devolucionesRepo.registrar(factura.numero, async (yaDevuelto) => {
    const nueva = construirDevolucion({ factura, pedido, plazo, yaDevuelto });
    await exigirAutorizacion(nueva, limite, pedido.autorizacion);
    return nueva;
  });
  return aDetalle({ ...registrada, motivo_nombre: motivo.nombre });
}

module.exports = {
  registrarDevolucion, construirDevolucion, validarPedido, MAS_DE_LO_COMPRADO, SIN_MOTIVO, MAX_OBSERVACIONES, SIN_OPCION,
  REQUIERE_AUTORIZACION,
};
