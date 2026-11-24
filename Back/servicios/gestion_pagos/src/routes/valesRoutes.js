const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const { generarVale } = require("../services/valesService");

// TDSI-75: vales de compra. Contrato: docs/contrato-vales.md
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-1032: generar un vale. Solo el servicio de Devoluciones (Sistema Cliente con token),
// porque el vale es dinero a favor del cliente.
router.post("/", verificarToken, wrap(async (req, res) => {
  const data = await generarVale(req.body);
  res.status(201).json({ ok: true, mensaje: "Vale generado", data });
}));

module.exports = router;
