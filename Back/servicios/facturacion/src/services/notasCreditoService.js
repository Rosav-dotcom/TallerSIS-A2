const repo = require("../data/notasCreditoRepo");
const { generarPdfNotaCredito } = require("./documentosService");
const contabilidad = require("./contabilidadService");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

// TDSI-73/1023: texto de la PA
const PASA_EL_TOTAL = "No se puede emitir una nota de crédito por más del total de la factura.";
const NO_ENCONTRADA = "Nota de crédito no encontrada";
const aCentavos = (v) => Math.round(Number(v) * 100);
const aMonto = (c) => c / 100;
const num = (v) => (v === null || v === undefined ? null : Number(v));

function texto(valor, campo, max, { obligatorio = true } = {}) {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) {
    if (obligatorio) throw err(`El campo '${campo}' es obligatorio.`);
    return null;
  }
  if ([...t].length > max) throw err(`El campo '${campo}' admite hasta ${max} caracteres.`);
  return t;
}

/** "NC-000001", "nc-1", "NC1" o "1" -> "NC-000001"; null si no es un numero de nota. */
function normalizarNumero(valor) {
  const m = /^(?:NC[-\s]?)?0*(\d{1,15})$/i.exec(String(valor ?? "").trim());
  return m ? `NC-${m[1].padStart(6, "0")}` : null;
}

function validarPedido(body) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const facturaNumero = texto(b.factura_numero, "factura_numero", 20).toUpperCase();
  const motivo = texto(b.motivo, "motivo", 300);
  const emitidaPor = texto(b.emitida_por, "emitida_por", 100);
  let devolucionCodigo = null;
  if (b.devolucion_codigo !== undefined && b.devolucion_codigo !== null && b.devolucion_codigo !== "") {
    devolucionCodigo = String(b.devolucion_codigo).trim().toUpperCase();
    if (!/^DEV-\d{6,}$/.test(devolucionCodigo)) throw err("El 'devolucion_codigo' debe tener la forma DEV-000123.");
  }

  if (!Array.isArray(b.items) || b.items.length === 0) throw err("La nota de crédito debe tener al menos un ítem.");
  if (b.items.length > 200) throw err("La nota de crédito admite hasta 200 ítems.");
  const items = b.items.map((it, i) => {
    const descripcion = texto(it?.descripcion, `items[${i}].descripcion`, 200);
    const cantidad = Number(it.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0 || Math.abs(cantidad * 100 - Math.round(cantidad * 100)) > 1e-6) {
      throw err(`La cantidad del ítem ${i + 1} debe ser mayor a 0 (hasta 2 decimales).`);
    }
    const precio = Number(it.precio_unitario);
    if (!Number.isFinite(precio) || precio < 0) throw err(`El precio del ítem ${i + 1} no es válido.`);
    const subtotalC = Math.round((Math.round(cantidad * 100) * aCentavos(precio)) / 100);
    return { descripcion, cantidad, precio_unitario: aMonto(aCentavos(precio)), subtotal: aMonto(subtotalC), _c: subtotalC };
  });
  const sumaC = items.reduce((a, it) => a + it._c, 0);

  let montoC = sumaC;
  if (b.monto !== undefined && b.monto !== null && b.monto !== "") {
    const monto = Number(b.monto);
    if (!Number.isFinite(monto) || monto <= 0) throw err("El monto debe ser mayor a 0.");
    montoC = aCentavos(monto);
    // con descuento la devolucion puede ser menor que la suma de los items, nunca mayor
    if (montoC > sumaC) throw err("El monto no puede ser mayor a la suma de los ítems.", 400, { monto, suma_items: aMonto(sumaC) });
  }
  if (montoC <= 0) throw err("El monto debe ser mayor a 0.");

  return { facturaNumero, motivo, emitidaPor, devolucionCodigo, items: items.map(({ _c, ...it }) => it), monto: aMonto(montoC) };
}

function aPublica(n) {
  return {
    numero: n.numero,
    // PA TDSI-1022: la factura original a la que pertenece
    factura_original: {
      numero: n.factura_numero,
      fecha: n.factura_fecha,
      total: num(n.factura_total),
      cliente_nit: n.cliente_nit,
      cliente_nombre: n.cliente_nombre,
    },
    devolucion_codigo: n.devolucion_codigo,
    motivo: n.motivo,
    monto: num(n.monto),
    estado: n.estado,
    emitida_por: n.emitida_por,
    emitida_en: n.emitida_en,
    items: (n.items || []).map((it) => ({
      descripcion: it.descripcion,
      cantidad: num(it.cantidad),
      precio_unitario: num(it.precio_unitario),
      subtotal: num(it.subtotal),
    })),
    pdf_url: `/api/notas-credito/${n.numero}/pdf`, // PA TDSI-1024
  };
}

/**
 * POST /api/notas-credito -- TDSI-73/1016: emite la nota de credito vinculada a la factura.
 * Cuerpo: { factura_numero, items: [{ descripcion, cantidad, precio_unitario }], monto?, motivo,
 *           emitida_por, devolucion_codigo? }. Sin monto, es la suma de los items.
 * Solo de una factura Emitida y nunca por mas de lo que le queda: total - notas ya emitidas
 * (PA TDSI-1023). Una devolucion tiene una sola nota.
 */
async function emitirNotaCredito(body) {
  const pedido = validarPedido(body);

  if (pedido.devolucionCodigo) {
    const existente = await repo.obtener({ devolucionCodigo: pedido.devolucionCodigo });
    if (existente) {
      throw err(`La devolución ${pedido.devolucionCodigo} ya tiene la nota de crédito ${existente.numero}.`, 409,
        { numero: existente.numero });
    }
  }

  let id;
  try {
    id = await repo.crear(pedido, async (factura, emitido) => {
      if (!factura) throw err("Factura no encontrada", 404, { numero: pedido.facturaNumero });
      if (factura.estado !== "Emitida") {
        throw err(`Solo se emite una nota de crédito de una factura emitida (la ${factura.numero} está ${factura.estado}).`, 409,
          { estado: factura.estado });
      }
      const disponibleC = aCentavos(factura.total) - aCentavos(emitido);
      if (aCentavos(pedido.monto) > disponibleC) {
        throw err(PASA_EL_TOTAL, 422, {
          total_factura: Number(factura.total), ya_emitido: emitido, disponible: aMonto(disponibleC), monto: pedido.monto,
        });
      }
    });
  } catch (e) {
    // dos pedidos a la vez para la misma devolucion: el segundo choca con el UNIQUE
    if (e.code === "23505" && String(e.constraint || "").includes("devolucion_codigo")) {
      const existente = await repo.obtener({ devolucionCodigo: pedido.devolucionCodigo });
      throw err(`La devolución ${pedido.devolucionCodigo} ya tiene la nota de crédito ${existente?.numero}.`, 409,
        { numero: existente?.numero });
    }
    throw e;
  }
  // TDSI-73/1018: se publica para Contabilidad; si falla, la nota igual queda emitida (reintentos).
  // Devuelve { nota, contabilidad } (igual que POST /api/facturas responde la factura y su envio).
  const envio = await contabilidad.enviarNotaCreditoSeguro(id);
  return { nota: aPublica(await repo.obtener({ id })), contabilidad: envio };
}

/** GET /api/notas-credito/:numero -- TDSI-73/1016: la nota con su factura original e items. */
async function obtenerNotaCredito(numero) {
  const normalizado = normalizarNumero(numero);
  const nota = normalizado ? await repo.obtener({ numero: normalizado }) : null;
  if (!nota) throw err(NO_ENCONTRADA, 404, { numero });
  return aPublica(nota);
}

/** GET /api/notas-credito?factura=F-... -- notas de una factura. */
async function listarNotasCredito({ factura } = {}) {
  const numero = typeof factura === "string" ? factura.trim().toUpperCase() : "";
  if (!numero) throw err("Indique la factura (?factura=F-000123).");
  return (await repo.listarPorFactura(numero)).map(aPublica);
}

/** GET /api/notas-credito/:numero/pdf -- TDSI-73/1024: PDF con el mismo formato que la factura. */
async function pdfNotaCredito(numero) {
  const normalizado = normalizarNumero(numero);
  const nota = normalizado ? await repo.obtener({ numero: normalizado }) : null;
  if (!nota) throw err(NO_ENCONTRADA, 404, { numero });
  return { numero: nota.numero, pdf: await generarPdfNotaCredito(nota) };
}

module.exports = {
  emitirNotaCredito, obtenerNotaCredito, listarNotasCredito, pdfNotaCredito, normalizarNumero, PASA_EL_TOTAL, NO_ENCONTRADA,
};
