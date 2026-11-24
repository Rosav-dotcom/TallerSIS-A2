const { Router } = require("express");
const { resumenDevolucionesDelDia } = require("../services/devolucionesCajaService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-80/1069: GET /api/caja/devoluciones?fecha=AAAA-MM-DD (por defecto hoy, hora de Bolivia)
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await resumenDevolucionesDelDia({ fecha: req.query.fecha }) });
}));

module.exports = router;
