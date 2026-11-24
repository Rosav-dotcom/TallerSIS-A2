const { AppError } = require("../utils/AppError");

// TDSI-68/991: Devoluciones no duplica las facturas -- el comprobante de venta (factura,
// items y metodos de pago) vive en el microservicio facturacion y se consulta por HTTP.
const FACTURACION_URL = (process.env.FACTURACION_URL || "http://localhost:4002").replace(/\/+$/, "");

async function pedir(ruta) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}${ruta}`);
  } catch (e) {
    throw new AppError("No se pudo consultar a Facturacion. Intente de nuevo.", 502);
  }
  const datos = await respuesta.json().catch(() => null);
  return { status: respuesta.status, ok: respuesta.ok, datos };
}

/** GET /api/facturas/buscar?q= -> { criterio: "numero"|"nit"|"cliente", facturas: [...] } */
async function buscarFacturas(q) {
  const r = await pedir(`/api/facturas/buscar?${new URLSearchParams({ q })}`);
  if (!r.ok) {
    // Un 400 de facturacion (busqueda vacia o muy larga) se le muestra igual al Encargado.
    if (r.status === 400) throw new AppError(r.datos?.mensaje || "Busqueda invalida.", 400);
    throw new AppError("Facturacion no pudo buscar el comprobante.", 502, { status: r.status });
  }
  return r.datos.data;
}

/** GET /api/facturas/:numero -> factura con items, metodosPago y codigo_barras; null si no existe. */
async function obtenerFactura(numero) {
  const r = await pedir(`/api/facturas/${encodeURIComponent(numero)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new AppError("Facturacion no pudo devolver el comprobante.", 502, { status: r.status });
  return r.datos.data;
}

// TDSI-80/1055: texto de la PA para un PIN incorrecto
const PIN_INVALIDO = "PIN inválido";

/**
 * TDSI-80/1085: POST /api/supervisores/validar (TDSI-55). Facturacion es el dueño de los
 * supervisores, sus PIN (con hash) y el bloqueo por intentos fallidos; aqui no se duplica nada.
 * - PIN incorrecto, con formato invalido o supervisor que no existe -> 401 "PIN invalido"
 *   (no se dice cual de los dos fallo).
 * - Supervisor bloqueado por intentos fallidos -> 423 con el mensaje de facturacion.
 * Devuelve { supervisor_id, nombre }.
 */
async function validarSupervisor({ supervisor_id, pin }) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/supervisores/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisor_id, pin }),
    });
  } catch (e) {
    throw new AppError("No se pudo validar al supervisor en este momento. Intente de nuevo.", 502);
  }
  const datos = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos.data;
  if (respuesta.status === 401 || respuesta.status === 400) {
    throw new AppError(PIN_INVALIDO, 401, datos?.detalle || null);
  }
  if (respuesta.status === 423) {
    throw new AppError(datos?.mensaje || "Supervisor bloqueado por intentos fallidos.", 423, datos?.detalle || null);
  }
  throw new AppError("No se pudo validar al supervisor en este momento. Intente de nuevo.", 502, { status: respuesta.status });
}

/**
 * TDSI-73/1016: POST /api/notas-credito de Facturacion (dueño de las notas de credito).
 * Un 4xx se devuelve con el mismo status y mensaje (p. ej. 422 si pasa el total de la factura,
 * 409 si la devolucion ya tiene nota, con detalle.numero); si Facturacion no responde, 502.
 */
async function emitirNotaCredito(cuerpo) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/notas-credito`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
  } catch (e) {
    throw new AppError("No se pudo emitir la nota de crédito: Facturación no responde. Intente de nuevo.", 502);
  }
  const datos = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos.data;
  if (respuesta.status >= 400 && respuesta.status < 500) {
    throw new AppError(datos?.mensaje || "Facturación no emitió la nota de crédito.", respuesta.status, datos?.detalle || null);
  }
  throw new AppError("No se pudo emitir la nota de crédito: Facturación no responde. Intente de nuevo.", 502, { status: respuesta.status });
}

/** GET /api/notas-credito/:numero de Facturacion; null si no existe. */
async function obtenerNotaCredito(numero) {
  const r = await pedir(`/api/notas-credito/${encodeURIComponent(numero)}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new AppError("No se pudo consultar la nota de crédito en Facturación.", 502, { status: r.status });
  return r.datos.data;
}

module.exports = { buscarFacturas, obtenerFactura, validarSupervisor, emitirNotaCredito, obtenerNotaCredito, PIN_INVALIDO };
