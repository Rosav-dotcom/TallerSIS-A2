const facturasRepo = require("../data/facturasRepo");
const clientesService = require("./clientesService");

function err(mensaje, status = 400, detalle = null) {
  const e = new Error(mensaje);
  e.status = status;
  e.detalle = detalle;
  return e;
}

function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw err("La factura debe tener al menos un item.");
  }
  for (const item of items) {
    if (
      !item.descripcion ||
      typeof item.cantidad !== "number" || item.cantidad <= 0 ||
      typeof item.precio_unitario !== "number" || item.precio_unitario < 0
    ) {
      throw err("Cada item debe tener descripcion, cantidad > 0 y precio_unitario >= 0.");
    }
  }
}

const METODOS_VALIDOS = ["Efectivo", "Tarjeta", "QR"];
const CANALES_VALIDOS = ["Presencial", "Online"];

/**
 * TDSI-68/991: como se pago la factura (facturacion.factura_metodos_pago), para que
 * Devoluciones muestre el metodo de pago del comprobante. Opcional: [{ metodo, monto }].
 * Con un solo metodo el monto puede omitirse (se toma el total de la factura).
 */
function validarMetodos(metodos, total) {
  if (metodos === undefined || metodos === null) return [];
  if (!Array.isArray(metodos) || metodos.length === 0) {
    throw err("'metodos' debe ser una lista de { metodo, monto }.");
  }
  const filas = metodos.map((m) => ({
    metodo: m && m.metodo,
    monto: m && m.monto !== undefined && m.monto !== null ? Number(m.monto) : metodos.length === 1 ? total : NaN,
  }));
  for (const f of filas) {
    if (!METODOS_VALIDOS.includes(f.metodo)) {
      throw err(`El metodo de pago debe ser uno de: ${METODOS_VALIDOS.join(", ")}.`, 400, { metodo: f.metodo });
    }
    if (!Number.isFinite(f.monto) || f.monto <= 0) {
      throw err("Cada metodo de pago necesita un monto mayor a 0.", 400, { metodo: f.metodo });
    }
  }
  const sumaC = filas.reduce((acc, f) => acc + Math.round(f.monto * 100), 0);
  if (sumaC !== Math.round(total * 100)) {
    throw err("La suma de los metodos de pago tiene que ser igual al total de la factura.", 400, { total });
  }
  return filas;
}

/** TDSI-89/279/280/281/282: ingresa el NIT y Razon Social del cliente al emitir la factura */
async function crearFactura({ nit, razon_social, items, metodos, canal } = {}) {
  validarItems(items);
  if (canal !== undefined && !CANALES_VALIDOS.includes(canal)) {
    throw err(`El canal debe ser uno de: ${CANALES_VALIDOS.join(", ")}.`, 400, { canal });
  }

  // TDSI-280/282: guardarCliente valida el formato del NIT antes de guardar la factura
  const cliente = await clientesService.guardarCliente({ nit, razon_social });

  const itemsConSubtotal = items.map((i) => ({ ...i, subtotal: i.cantidad * i.precio_unitario }));
  const subtotal = itemsConSubtotal.reduce((acc, i) => acc + i.subtotal, 0);
  const metodosPago = validarMetodos(metodos, subtotal);

  const factura = await facturasRepo.crearFactura({
    cliente_nit: cliente.nit,
    cliente_nombre: cliente.razon_social,
    items: itemsConSubtotal,
    metodos: metodosPago,
    canal,
    subtotal,
    descuento: 0,
    impuesto: 0,
    total: subtotal,
  });

  return factura;
}

const BUSQUEDA_MAX = 100;

/**
 * TDSI-68/991: busca facturas para el Encargado de Devoluciones, con las mismas reglas
 * que el buscador de "Facturas" del cajero (TDSI-46), adaptadas a la numeracion F-NNNNNN:
 * - "F-000123", "f-123", "F 123", "F123" o solo "123" (hasta 6 digitos): N° de factura.
 *   Es lo que escribe el lector de codigo de barras del ticket (el codigo es el N°).
 * - 7 a 15 digitos: NIT/CI del cliente (exacto), todas sus compras.
 * - Cualquier otro texto: parte del nombre del cliente, sin mayusculas ni tildes.
 * Devuelve { criterio, facturas } (sin items: el detalle va por GET /api/facturas/:numero).
 */
async function buscarFacturas(q) {
  if (Array.isArray(q)) throw err("El parametro 'q' debe enviarse una sola vez.");
  const texto = q === undefined || q === null ? "" : String(q).trim();
  if (!texto) throw err("Escriba el N° de factura, el NIT/CI o escanee el codigo de barras.");
  if (texto.length > BUSQUEDA_MAX) throw err(`La busqueda admite hasta ${BUSQUEDA_MAX} caracteres.`);

  const numero = /^(?:F[-\s]?)?(\d{1,6})$/i.exec(texto);
  if (numero) {
    return { criterio: "numero", facturas: await facturasRepo.buscarPorNumero(numero[1]) };
  }
  if (/^\d{7,15}$/.test(texto)) {
    return { criterio: "nit", facturas: await facturasRepo.buscarPorNit(texto) };
  }
  return { criterio: "cliente", facturas: await facturasRepo.buscarPorCliente(texto) };
}

module.exports = { crearFactura, buscarFacturas };
