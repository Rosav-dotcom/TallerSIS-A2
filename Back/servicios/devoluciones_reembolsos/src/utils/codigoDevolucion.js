// TDSI-76: codigo unico y correlativo de cada devolucion, "DEV-" + 6 digitos (DEV-000123).
// Lo genera la BD al registrar (trigger trg_devoluciones_codigo de sql/script_devoluciones.sql);
// aqui solo se le da formato y se reconoce lo que escribe el usuario en el buscador.
const PREFIJO = "DEV-";
const FORMATO = /^DEV-\d{6,}$/;

/** 123 -> "DEV-000123" (desde el millon sigue creciendo: DEV-1000000). */
function formatearCodigo(numero) {
  const n = Number(numero);
  if (!Number.isSafeInteger(n) || n < 1) return null;
  return PREFIJO + String(n).padStart(6, "0");
}

/**
 * TDSI-1112: "DEV-000123", "dev-123", "DEV 123", "DEV123", "123" o "000123" -> "DEV-000123".
 * null si el texto no es un codigo de devolucion.
 */
function normalizarCodigo(texto) {
  if (typeof texto !== "string" && typeof texto !== "number") return null;
  const m = /^(?:DEV[-\s]?)?0*(\d{1,15})$/i.exec(String(texto).trim());
  return m ? formatearCodigo(m[1]) : null;
}

module.exports = { PREFIJO, FORMATO, formatearCodigo, normalizarCodigo };
