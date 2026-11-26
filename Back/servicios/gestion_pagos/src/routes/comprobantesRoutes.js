const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { enviarComprobante } = require("../services/comprobantesService");

// TDSI-79: correo con el comprobante del reembolso (y la nota de crédito) al cliente.
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Lo llama el servicio de Devoluciones (Sistema Cliente con token) al terminar la devolución
router.post("/reembolso", verificarToken, wrap(async (req, res) => {
  const data = await enviarComprobante(req.body);
  res.json({
    ok: true,
    mensaje: data.estado === "ERROR" ? "No se pudo enviar el correo" : `Comprobante enviado a ${data.email}`,
    data,
  });
}));

module.exports = router;
