const { AppError } = require("../utils/AppError");
const { validarEmail } = require("../utils/email");
const reversionesRepo = require("../data/reversionesRepo");
const valesRepo = require("../data/valesRepo");
const { enviarComprobanteReembolso } = require("./emailService");
const facturacionProxy = require("./facturacionProxy");

// TDSI-79/235: al terminar la devolución, el cliente recibe por correo el comprobante
// del reembolso. Lo pide el servicio de Devoluciones (Equipo 1) con su token.
// Los datos del reembolso se leen de su dueño aquí mismo (la reversión de TDSI-74 o
// el vale de TDSI-75), así el correo no puede decir un monto distinto al real.
// TDSI-1083: si hay nota de crédito, su PDF (de Facturación, TDSI-73) va adjunto.

const EMPRESA = { nombre: "TallerSis", direccion: "Av. Principal s/n, Bolivia" };
const FORMATO_ID = /^[A-Za-z0-9_-]{1,60}$/;
const METODOS_DIRECTOS = ["Efectivo", "QR"]; // los que no tienen un registro propio en gestion_pagos

function texto(valor, campo, { requerido = true, max = 100 } = {}) {
  if (Array.isArray(valor) || (valor !== null && typeof valor === "object")) {
    throw new AppError(`El campo '${campo}' no tiene un formato válido.`, 400);
  }
  const limpio = valor === undefined || valor === null ? "" : String(valor).trim();
  if (requerido && !limpio) throw new AppError(`Falta el campo '${campo}'.`, 400);
  if (limpio.length > max) throw new AppError(`El campo '${campo}' admite hasta ${max} caracteres.`, 400);
  return limpio || null;
}

function id(valor, campo, opciones) {
  const limpio = texto(valor, campo, { max: 60, ...opciones });
  if (limpio && !FORMATO_ID.test(limpio)) throw new AppError(`El ${campo} no tiene un formato válido.`, 400, { [campo]: limpio });
  return limpio;
}

function correo(valor) {
  const error = validarEmail(valor);
  if (error || Array.isArray(valor)) throw new AppError(error || "Ingrese un correo válido.", 400, { email: valor ?? null });
  return String(valor).trim().toLowerCase();
}

/** Arma los datos del reembolso según de dónde salió el dinero. null si no hubo reembolso. */
async function datosReembolso(r) {
  if (r === undefined || r === null) return null;
  if (typeof r !== "object" || Array.isArray(r)) throw new AppError("El campo 'reembolso' debe ser un objeto.", 400);

  if (r.reversion_id !== undefined && r.reversion_id !== null) {
    const reversionId = Number(r.reversion_id);
    if (!Number.isInteger(reversionId) || reversionId <= 0) throw new AppError("El reversion_id no es válido.", 400);
    const reversion = await reversionesRepo.obtener(reversionId);
    if (!reversion) throw new AppError(`No existe la reversión ${reversionId}.`, 404);
    if (reversion.estado !== "CONFIRMADA") {
      throw new AppError(
        "La reversión todavía no está confirmada por la pasarela; el comprobante se envía cuando se confirme.",
        409,
        { reversion_id: reversionId, estado: reversion.estado }
      );
    }
    return {
      metodo: "Tarjeta",
      monto: reversion.monto,
      referencia: reversion.referencia_pasarela,
      id_transaccion: reversion.id_transaccion,
      reversion_id: reversion.id,
    };
  }

  if (r.vale_codigo !== undefined && r.vale_codigo !== null) {
    const codigo = texto(r.vale_codigo, "vale_codigo", { max: 20 }).toUpperCase();
    const vale = await valesRepo.obtener(codigo);
    if (!vale) throw new AppError(`No existe el vale ${codigo}.`, 404);
    return { metodo: "Vale", monto: vale.monto, referencia: vale.codigo, expira_en: vale.expira_en };
  }

  const metodo = texto(r.metodo, "reembolso.metodo", { max: 20 });
  if (!METODOS_DIRECTOS.includes(metodo)) {
    throw new AppError(
      "reembolso.metodo debe ser Efectivo o QR. Para tarjeta envíe reversion_id y para vale envíe vale_codigo.",
      400,
      { metodo }
    );
  }
  const monto = Number(r.monto);
  if (!Number.isFinite(monto) || monto <= 0 || Math.round(monto * 100) / 100 !== monto) {
    throw new AppError("reembolso.monto debe ser mayor a 0 y con hasta 2 decimales.", 400, { monto: r.monto ?? null });
  }
  return { metodo, monto, referencia: texto(r.referencia, "reembolso.referencia", { requerido: false, max: 60 }) };
}

/** TDSI-1083: número de la nota de crédito como lo numera Facturación (NC-000001). */
function numeroNotaCredito(valor) {
  const limpio = texto(valor, "nota_credito", { requerido: false, max: 20 });
  if (!limpio) return null;
  const m = /^NC-?(\d{1,6})$/i.exec(limpio);
  if (!m) throw new AppError("La nota_credito debe tener el formato NC-000001.", 400, { nota_credito: limpio });
  return `NC-${m[1].padStart(6, "0")}`;
}

/** Valida el pedido de Devoluciones y arma el comprobante que va en el correo. */
async function armarComprobante(body = {}) {
  const email = correo(body.email);
  const devolucion_id = id(body.devolucion_id, "devolucion_id");
  const nota_credito = numeroNotaCredito(body.nota_credito);
  const reembolso = await datosReembolso(body.reembolso);
  if (!reembolso && !nota_credito) {
    throw new AppError("Envíe el reembolso, la nota_credito o los dos: no hay nada que mandar al cliente.", 400);
  }
  const tipo = reembolso ? (reembolso.metodo === "Vale" ? "VALE" : "REEMBOLSO") : "NOTA_CREDITO";

  return {
    email,
    tipo,
    comprobante: {
      empresa: EMPRESA,
      devolucion_id,
      fecha: new Date().toISOString(),
      cliente: texto(body.cliente, "cliente", { requerido: false, max: 150 }),
      nota_credito,
      reembolso,
    },
  };
}

/**
 * TDSI-1083: pide el PDF de la nota de crédito a Facturación y lo adjunta.
 * Si no se puede obtener, el correo NO sale incompleto: queda en ERROR con el motivo
 * (el criterio pide que el correo lleve el PDF) y se puede reenviar después.
 */
async function mandar({ email, comprobante }) {
  const adjuntos = [];
  if (comprobante.nota_credito) {
    try {
      const pdf = await facturacionProxy.obtenerPdfNotaCredito(comprobante.nota_credito);
      adjuntos.push({ filename: `${comprobante.nota_credito}.pdf`, content: pdf, contentType: "application/pdf" });
    } catch (e) {
      return { estado: "ERROR", error: e.message };
    }
  }
  const resultado = await enviarComprobanteReembolso({ email, comprobante, adjuntos });
  return { estado: resultado.estado, error: resultado.error || null };
}

async function enviarComprobante(body) {
  const { email, tipo, comprobante } = await armarComprobante(body);
  const resultado = await mandar({ email, comprobante });
  return { tipo, email, estado: resultado.estado, error: resultado.error, comprobante };
}

module.exports = { enviarComprobante, armarComprobante };
