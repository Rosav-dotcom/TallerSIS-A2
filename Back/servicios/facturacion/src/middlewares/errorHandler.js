// TDSI-73/223: errores de la BD con respuesta propia (no son un 500).
const ERRORES_BD = {
  NC001: { status: 422, mensaje: "La nota de crédito no puede superar el total de la factura." }, // trg_notas_credito_tope
};

function errorHandler(err, req, res, next) {
  const conocido = !err.status && ERRORES_BD[err.code];
  if (conocido) return res.status(conocido.status).json({ ok: false, mensaje: conocido.mensaje, detalle: null });
  if (err.status) {
    return res.status(err.status).json({ ok: false, mensaje: err.message, detalle: err.detalle || null });
  }
  console.error(err);
  return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
}
module.exports = { errorHandler };