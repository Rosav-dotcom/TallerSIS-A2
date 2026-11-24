const crypto = require("crypto");
const { AppError } = require("../utils/AppError");
const repo = require("../data/valesRepo");

// TDSI-75: vales de compra (saldo a favor). Acuerdo de equipo: los genera y los guarda
// gestion_pagos; Devoluciones solo guarda el código. El QR lo dibuja el frontend con el código.

// Sin I, L, O, 0 ni 1: no se confunden al leerlos o dictarlos
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const FORMATO_CODIGO = /^VAL-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const MONTO_MAXIMO = 100000;
const DIAS_MAXIMO = 365;
const INTENTOS_CODIGO = 5;
const TEXTO_MAX = 100;

const diasPorDefecto = () => Number(process.env.VALE_DIAS_VALIDEZ || 90);

/** VAL-XXXX-XXXX con caracteres al azar (crypto, no Math.random). */
function generarCodigo(aleatorio = (n) => crypto.randomInt(n)) {
  const bloque = () => Array.from({ length: 4 }, () => ALFABETO[aleatorio(ALFABETO.length)]).join("");
  return `VAL-${bloque()}-${bloque()}`;
}

function texto(valor, campo, { requerido = false, max = TEXTO_MAX } = {}) {
  if (Array.isArray(valor) || (valor !== null && typeof valor === "object")) {
    throw new AppError(`El campo '${campo}' no es válido.`, 400);
  }
  const limpio = valor === undefined || valor === null ? "" : String(valor).trim();
  if (requerido && !limpio) throw new AppError(`El campo '${campo}' es obligatorio.`, 400);
  if (limpio.length > max) throw new AppError(`El campo '${campo}' admite hasta ${max} caracteres.`, 400);
  return limpio || null;
}

function validarMonto(valor) {
  const monto = typeof valor === "string" && valor.trim() !== "" ? Number(valor) : valor;
  if (typeof monto !== "number" || !Number.isFinite(monto) || monto <= 0) {
    throw new AppError("El monto del vale debe ser un número mayor a 0.", 400);
  }
  if (monto > MONTO_MAXIMO) throw new AppError(`El monto del vale no puede pasar de Bs. ${MONTO_MAXIMO}.`, 400);
  // Se compara con el monto redondeado a centavos (multiplicar por 100 falla con montos como 0.29)
  if (Math.abs(Math.round(monto * 100) / 100 - monto) > 1e-9) throw new AppError("El monto admite hasta 2 decimales.", 400);
  return monto;
}

function validarDias(valor) {
  if (valor === undefined || valor === null || valor === "") return diasPorDefecto();
  const dias = Number(valor);
  if (!Number.isInteger(dias) || dias < 1 || dias > DIAS_MAXIMO) {
    throw new AppError(`Los días de validez deben ser un entero entre 1 y ${DIAS_MAXIMO}.`, 400);
  }
  return dias;
}

/**
 * TDSI-1032: genera un vale con código único, monto y fecha de expiración.
 * opciones.generar permite fijar el generador de códigos en los tests.
 */
async function generarVale(datos = {}, { generar = generarCodigo } = {}) {
  const monto = validarMonto(datos.monto);
  const dias = validarDias(datos.dias_validez);
  const emitido_por = texto(datos.emitido_por, "emitido_por", { requerido: true });
  const devolucion_id = texto(datos.devolucion_id, "devolucion_id", { max: 60 });

  for (let intento = 1; intento <= INTENTOS_CODIGO; intento += 1) {
    try {
      return await repo.crear({ codigo: generar(), monto, dias, devolucion_id, emitido_por });
    } catch (e) {
      // 23505 = el código ya existe: se prueba con otro
      if (e.code !== "23505" || intento === INTENTOS_CODIGO) throw e;
    }
  }
  return null; // no se llega aquí
}

const ESTADOS = ["Activo", "Usado", "Expirado"];

function codigoValido(valor) {
  const codigo = String(valor ?? "").trim().toUpperCase();
  if (!FORMATO_CODIGO.test(codigo)) {
    throw new AppError("El código del vale no es válido.", 400, "El formato es VAL-XXXX-XXXX");
  }
  return codigo;
}

/** TDSI-1081: saldo y estado de un vale por su código (acepta minúsculas). */
async function consultarVale(codigo) {
  const c = codigoValido(codigo);
  const vale = await repo.obtener(c);
  if (!vale) throw new AppError(`No existe un vale con el código ${c}.`, 404);
  return vale;
}

/** TDSI-1081: lista de vales con filtros opcionales: estado, parte del código y devolución. */
async function listarVales(consulta = {}) {
  const estado = texto(consulta.estado, "estado", { max: 20 });
  if (estado && !ESTADOS.includes(estado)) throw new AppError(`El estado debe ser ${ESTADOS.join(", ")}.`, 400);
  const parte = texto(consulta.codigo, "codigo", { max: 20 });
  if (parte && !/^[A-Za-z0-9-]+$/.test(parte)) throw new AppError("El código solo tiene letras, números y guiones.", 400);
  const devolucion_id = texto(consulta.devolucion_id, "devolucion_id", { max: 60 });
  return repo.listar({ estado, codigo: parte ? `%${parte.toUpperCase()}%` : null, devolucion_id });
}

module.exports = { generarVale, consultarVale, listarVales, generarCodigo, validarMonto, codigoValido, FORMATO_CODIGO, ALFABETO, ESTADOS, texto };
