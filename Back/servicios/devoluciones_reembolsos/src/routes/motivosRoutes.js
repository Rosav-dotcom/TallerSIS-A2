const { Router } = require("express");
const motivosRepo = require("../data/motivosRepo");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-71/1102: motivos activos para el paso 3 "Motivo" de "Nueva devolucion" (solo los 4 de la historia).
router.get("/", wrap(async (req, res) => {
  const motivos = await motivosRepo.listarActivos();
  res.json({ ok: true, data: motivos.map((m) => ({ id: Number(m.id), nombre: m.nombre })) });
}));

module.exports = router;
