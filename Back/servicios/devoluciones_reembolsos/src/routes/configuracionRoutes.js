const { Router } = require("express");
const { obtenerPlazoDias } = require("../services/configuracionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-69/1097: plazo de devolucion vigente (dias habiles). Se cambia en devoluciones.configuracion.
router.get("/plazo", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerPlazoDias() });
}));

module.exports = router;
