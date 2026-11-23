const { AppError } = require("../utils/AppError");
const facturacion = require("../clients/facturacionClient");
const { plazoDeComprobante } = require("./plazoService");
const { obtenerPlazoDias } = require("./configuracionService");

// TDSI-68/996: texto exacto que pide la PA para una factura anulada o que no existe.
const NO_DISPONIBLE = "Comprobante no encontrado o anulado";

const num = (v) => Number(v);

/** Comprobante listo para la pantalla: items, cantidades, montos, fecha y metodo de pago. */
function aComprobante(f) {
  const metodos = (f.metodosPago || []).map((m) => ({ metodo: m.metodo, monto: num(m.monto) }));
  return {
    numero: f.numero,
    codigo_barras: f.codigo_barras || f.numero,
    fecha: f.fecha,
    cliente_nit: f.cliente_nit,
    cliente_nombre: f.cliente_nombre,
    canal: f.canal,
    estado: f.estado,
    subtotal: num(f.subtotal),
    descuento: num(f.descuento),
    impuesto: num(f.impuesto),
    total: num(f.total),
    items: (f.items || []).map((i) => ({
      descripcion: i.descripcion,
      cantidad: num(i.cantidad),
      precio_unitario: num(i.precio_unitario),
      subtotal: num(i.subtotal),
    })),
    metodos_pago: metodos,
    metodo_pago: metodos.length ? metodos.map((m) => m.metodo).join(" + ") : null,
  };
}

/**
 * TDSI-68: solo una factura emitida puede ser el comprobante de una devolucion. Anulada,
 * en borrador o inexistente -> 404 "Comprobante no encontrado o anulado"; con una
 * anulacion pendiente -> 409, porque podria terminar anulada (y no se devuelve dos veces).
 */
function verificarDisponible(factura, numero) {
  if (!factura || factura.estado === "Anulada" || factura.estado === "Borrador") {
    throw new AppError(NO_DISPONIBLE, 404, { numero });
  }
  if (factura.estado === "AnulacionSolicitada") {
    throw new AppError(
      `La factura ${factura.numero} tiene una anulacion pendiente: no se puede devolver hasta que se resuelva.`,
      409,
      { numero: factura.numero, estado: factura.estado }
    );
  }
}

/** Factura emitida que puede ser el comprobante de una devolucion (si no, 404/409). */
async function facturaDisponible(numero) {
  const valor = String(numero || "").trim().toUpperCase();
  if (!valor) throw new AppError(NO_DISPONIBLE, 404);
  const factura = await facturacion.obtenerFactura(valor);
  verificarDisponible(factura, valor);
  return factura;
}

/** GET /api/devoluciones/comprobantes/:numero -- TDSI-69: trae tambien su "plazo". */
async function obtenerComprobante(numero) {
  const factura = await facturaDisponible(numero);
  return { ...aComprobante(factura), plazo: await plazoDeComprobante(factura.fecha) };
}

/**
 * GET /api/devoluciones/comprobantes/:numero/plazo -- TDSI-69/1098: si el comprobante esta
 * dentro del plazo de devolucion y cuantos dias habiles pasaron desde su emision.
 */
async function obtenerPlazo(numero) {
  const factura = await facturaDisponible(numero);
  return { numero: factura.numero, ...(await plazoDeComprobante(factura.fecha)) };
}

/**
 * GET /api/devoluciones/comprobantes?q= -- TDSI-68/991. La busqueda la resuelve facturacion
 * con las reglas de TDSI-46 (N° de factura o codigo de barras, NIT/CI, nombre del cliente):
 * - por N° o codigo de barras: { criterio, comprobante } con el detalle completo (TDSI-994).
 * - por NIT/CI o nombre: { criterio, compras } con las compras del cliente que se pueden
 *   devolver (sin las anuladas); el detalle de cada una va por /comprobantes/:numero (TDSI-995).
 */
async function buscarComprobantes(q) {
  if (Array.isArray(q)) throw new AppError("El parametro 'q' debe enviarse una sola vez.", 400);
  const texto = q === undefined || q === null ? "" : String(q).trim();
  if (!texto) throw new AppError("Escriba el N° de factura, el NIT/CI o escanee el codigo de barras.", 400);

  const { criterio, facturas } = await facturacion.buscarFacturas(texto);

  if (criterio === "numero") {
    if (!facturas.length) throw new AppError(NO_DISPONIBLE, 404, { q });
    return { criterio, comprobante: await obtenerComprobante(facturas[0].numero) };
  }

  const disponibles = facturas.filter((f) => f.estado !== "Anulada" && f.estado !== "Borrador");
  if (!disponibles.length) throw new AppError(NO_DISPONIBLE, 404, { q });

  // TDSI-69: cada compra de la lista dice si todavia esta en plazo (la configuracion se lee una vez)
  const { plazo_dias: plazoDias } = await obtenerPlazoDias();
  const compras = await Promise.all(disponibles.map(async (f) => {
    const plazo = await plazoDeComprobante(f.fecha, { plazoDias });
    return {
      numero: f.numero,
      fecha: f.fecha,
      cliente_nit: f.cliente_nit,
      cliente_nombre: f.cliente_nombre,
      canal: f.canal,
      total: num(f.total),
      estado: f.estado,
      dias_transcurridos: plazo.dias_transcurridos,
      fecha_limite: plazo.fecha_limite,
      dentro_de_plazo: plazo.dentro_de_plazo,
    };
  }));
  return { criterio, compras };
}

module.exports = { buscarComprobantes, obtenerComprobante, obtenerPlazo, NO_DISPONIBLE };
