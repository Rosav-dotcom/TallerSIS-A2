const { AppError } = require("../utils/AppError");

// TDSI-76/1111: errores de la BD que tienen respuesta propia (no son un 500).
const ERRORES_BD = {
  DV001: { status: 409, mensaje: "El código de la devolución no se puede editar." }, // trigger trg_devoluciones_codigo_inmutable
  23505: { status: 409, mensaje: "Ya existe un registro con ese código." }, // UNIQUE
};

function errorHandler(err, req, res, next) {
  if (err instanceof AppError || err.status) {
    return res.status(err.status || 400).json({ ok: false, mensaje: err.message, detalle: err.detalle || null });
  }
  const conocido = ERRORES_BD[err.code];
  if (conocido) {
    return res.status(conocido.status).json({ ok: false, mensaje: conocido.mensaje, detalle: null });
  }
  console.error(err);
  return res.status(500).json({ ok: false, mensaje: "Error interno del servidor" });
}
module.exports = { errorHandler };
