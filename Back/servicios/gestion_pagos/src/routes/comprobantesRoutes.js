const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const {
  enviarComprobante,
  reenviarComprobante,
  obtenerEnvio,
  listarEnvios,
} = require("../services/comprobantesService");

// TDSI-79: correo con el comprobante del reembolso (y la nota de crédito) al cliente.
// Contrato: docs/contrato-comprobantes.md
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

const mensaje = (e) =>
  e.estado === "Enviado"
    ? `Comprobante enviado a ${e.email}${e.simulado ? " (simulado: no hay credenciales SMTP)" : ""}`
    : "No se pudo enviar el correo; se puede reenviar";

// Lo llama el servicio de Devoluciones (Sistema Cliente con token) al terminar la devolución.
// 201 aunque el correo falle: el envío queda registrado en Error y se puede reenviar.
router.post("/reembolso", verificarToken, wrap(async (req, res) => {
  const data = await enviarComprobante(req.body);
  res.status(201).json({ ok: true, mensaje: mensaje(data), data });
}));

// TDSI-1121: estado de los envíos y reenvío; los usa la página "Comprobante de reembolso"
router.get("/envios", wrap(async (req, res) => {
  const data = await listarEnvios(req.query);
  res.json({ ok: true, total: data.length, data });
}));

router.get("/envios/:id", wrap(async (req, res) => res.json({ ok: true, data: await obtenerEnvio(req.params.id) })));

router.post("/envios/:id/reenviar", wrap(async (req, res) => {
  const data = await reenviarComprobante(req.params.id, req.body);
  res.json({ ok: true, mensaje: mensaje(data), data });
}));

module.exports = router;
