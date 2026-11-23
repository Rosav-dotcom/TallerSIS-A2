const { Router } = require("express");
const { verificarToken } = require("../middlewares/verificarToken");
const {
  crearReversion,
  reintentarReversion,
  obtenerReversion,
  listarReversiones,
} = require("../services/reversionService");

// TDSI-1026 (TDSI-74): reversión de pagos con tarjeta. Contrato: docs/contrato-reversion.md
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Crear: solo el servicio de Devoluciones (Sistema Cliente con token), porque devuelve dinero
router.post("/", verificarToken, wrap(async (req, res) => {
  const data = await crearReversion(req.body);
  res.status(201).json({
    ok: true,
    mensaje: data.estado === "CONFIRMADA"
      ? "Reversión confirmada por la pasarela"
      : "La pasarela no respondió: la reversión quedó en ERROR y se puede reintentar",
    data,
  });
}));

// Consultar y reintentar: los usa la página "Comprobante de reembolso" (TDSI-1080)
router.get("/", wrap(async (req, res) => {
  const data = await listarReversiones(req.query);
  res.json({ ok: true, total: data.length, data });
}));

router.get("/:id", wrap(async (req, res) => res.json({ ok: true, data: await obtenerReversion(req.params.id) })));

router.post("/:id/reintentar", wrap(async (req, res) => {
  const data = await reintentarReversion(req.params.id);
  res.json({
    ok: true,
    mensaje: data.estado === "CONFIRMADA" ? "Reversión confirmada por la pasarela" : "La pasarela volvió a fallar",
    data,
  });
}));

module.exports = router;
