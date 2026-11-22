const { Router } = require("express");
const { buscarComprobantes, obtenerComprobante } = require("../services/comprobantesService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-68/991: ?q= codigo de barras del ticket, N° de factura o NIT/CI (o nombre del cliente).
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await buscarComprobantes(req.query.q) });
}));

// TDSI-68/994: detalle del comprobante elegido de la lista de compras del cliente.
router.get("/:numero", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerComprobante(req.params.numero) });
}));

module.exports = router;
