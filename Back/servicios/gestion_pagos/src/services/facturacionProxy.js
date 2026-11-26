// TDSI-51/683: emite la factura de una venta online a traves del microservicio
// facturacion, que es el dueno real de la numeracion oficial (F-NNNNNN) -- gestion_pagos
// nunca inventa su propio numero de factura. Mismo patron que clientesProxy.js.
const FACTURACION_URL = process.env.FACTURACION_URL || "http://localhost:4002";

/** Devuelve la factura creada ({ numero, id, ... }); lanza un Error con un mensaje claro si falla. */
async function emitirFactura({ nit, razon_social, items }) {
  let respuesta;
  try {
    respuesta = await fetch(`${FACTURACION_URL}/api/facturas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nit, razon_social, items }),
    });
  } catch (e) {
    throw new Error("No se pudo contactar a facturacion para emitir la factura.");
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new Error(datos?.mensaje || "facturacion no pudo emitir la factura.");
  }
  return datos.data;
}

/**
 * TDSI-79/1083: el PDF de una nota de crédito lo genera Facturación (TDSI-73,
 * GET /api/notas-credito/:numero/pdf). Devuelve un Buffer; lanza un Error claro si falla.
 * La URL se lee en cada llamada para que los tests puedan apuntar a un Facturación falso.
 */
async function obtenerPdfNotaCredito(numero) {
  const base = process.env.FACTURACION_URL || FACTURACION_URL;
  let respuesta;
  try {
    respuesta = await fetch(`${base}/api/notas-credito/${encodeURIComponent(numero)}/pdf`, {
      signal: AbortSignal.timeout(Number(process.env.FACTURACION_TIMEOUT_MS || 10000)),
    });
  } catch (e) {
    throw new Error("No se pudo contactar a facturacion para obtener el PDF de la nota de crédito.");
  }
  if (respuesta.status === 404) throw new Error(`Facturación no encuentra la nota de crédito ${numero}.`);
  if (!respuesta.ok) throw new Error(`Facturación no pudo generar el PDF de la nota de crédito ${numero} (HTTP ${respuesta.status}).`);

  const tipo = respuesta.headers.get("content-type") || "";
  const pdf = Buffer.from(await respuesta.arrayBuffer());
  if (!tipo.includes("application/pdf") || pdf.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error(`Facturación no devolvió un PDF válido para la nota de crédito ${numero}.`);
  }
  return pdf;
}

module.exports = { emitirFactura, obtenerPdfNotaCredito };
