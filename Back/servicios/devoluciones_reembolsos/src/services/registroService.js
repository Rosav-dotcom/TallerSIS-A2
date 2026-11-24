const { AppError } = require("../utils/AppError");
const devolucionesRepo = require("../data/devolucionesRepo");
const { facturaDisponible } = require("./comprobantesService");
const { plazoDeComprobante } = require("./plazoService");
const { aDetalle } = require("./devolucionesService");

// TDSI-70/1001: registro de una devolucion total o parcial eligiendo items y cantidades.
const MAS_DE_LO_COMPRADO = "No se puede devolver más unidades de las compradas";
const CONDICIONES = ["REINGRESO", "MERMA"];
const MAX_ITEMS = 200;

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

  let creadoPor = null;
  if (body.creado_por !== undefined && body.creado_por !== null) {
    creadoPor = String(body.creado_por).trim().slice(0, 60) || null;
  }
  return { facturaNumero, items, creadoPor };
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
      creado_por: pedido.creadoPor,
    },
    items: items.map(({ _subtotalC, ...it }) => it),
  };
}

/**
 * POST /api/devoluciones -- TDSI-70/1001.
 * Cuerpo: { factura_numero, items: [{ item_id, cantidad, condicion? }], creado_por? }
 * item_id es el de cada item del comprobante (GET /api/devoluciones/comprobantes/:numero).
 * El motivo (TDSI-71), la opcion de reembolso (TDSI-72) y la autorizacion del supervisor
 * (TDSI-80) se suman en sus historias.
 */
async function registrarDevolucion(body) {
  const pedido = validarPedido(body);

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

  const registrada = await devolucionesRepo.registrar(factura.numero, (yaDevuelto) =>
    construirDevolucion({ factura, pedido, plazo, yaDevuelto })
  );
  return aDetalle(registrada);
}

module.exports = { registrarDevolucion, construirDevolucion, validarPedido, MAS_DE_LO_COMPRADO };
