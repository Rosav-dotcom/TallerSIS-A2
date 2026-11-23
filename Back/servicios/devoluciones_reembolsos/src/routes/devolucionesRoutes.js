const { Router } = require("express");
const { listarDevoluciones, obtenerDevolucion } = require("../services/devolucionesService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-76/1112: lista de devoluciones; ?codigo= busca por su codigo DEV- (acepta "dev-123" o "123").
// No hay PUT/PATCH del codigo: es unico y no se edita (TDSI-1111).
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await listarDevoluciones({ codigo: req.query.codigo }) });
}));

// TDSI-76/1112: detalle de una devolucion por su codigo (ruta /devoluciones/:codigo del Front).
router.get("/:codigo", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerDevolucion(req.params.codigo) });
}));

module.exports = router;
