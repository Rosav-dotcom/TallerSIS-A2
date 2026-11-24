const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { generarVale, consultarVale, listarVales } = require("../services/valesService");

// TDSI-75: vales de compra. Contrato: docs/contrato-vales.md
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-1032: generar un vale. Solo el servicio de Devoluciones (Sistema Cliente con token),
// porque el vale es dinero a favor del cliente.
router.post("/", verificarToken, wrap(async (req, res) => {
  const data = await generarVale(req.body);
  res.status(201).json({ ok: true, mensaje: "Vale generado", data });
}));

// TDSI-1081: consultar (los usa la página "Vale de compra" del Encargado, sin token)
router.get("/", wrap(async (req, res) => {
  const data = await listarVales(req.query);
  res.json({ ok: true, total: data.length, data });
}));

router.get("/:codigo", wrap(async (req, res) => res.json({ ok: true, data: await consultarVale(req.params.codigo) })));

module.exports = router;
