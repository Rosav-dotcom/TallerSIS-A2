const { Router } = require("express");
const { listarDevoluciones, obtenerDevolucion } = require("../services/devolucionesService");
const { registrarDevolucion } = require("../services/registroService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-76/1112: lista de devoluciones; ?codigo= busca por su codigo DEV- (acepta "dev-123" o "123").
// TDSI-70: filtros ?estado= (PENDIENTE, APROBADA, RECHAZADA, PROCESADA) y ?desde=&hasta= (AAAA-MM-DD).
// No hay PUT/PATCH del codigo: es unico y no se edita (TDSI-1111).
router.get("/", wrap(async (req, res) => {
  const { codigo, estado, desde, hasta } = req.query;
  res.json({ ok: true, data: await listarDevoluciones({ codigo, estado, desde, hasta }) });
}));

// TDSI-70/1001: registra una devolucion total o parcial con los items y cantidades elegidos.
router.post("/", wrap(async (req, res) => {
  const devolucion = await registrarDevolucion(req.body);
  res.status(201).json({ ok: true, mensaje: `Devolución ${devolucion.codigo} registrada.`, data: devolucion });
}));

// TDSI-76/1112: detalle de una devolucion por su codigo (ruta /devoluciones/:codigo del Front).
router.get("/:codigo", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerDevolucion(req.params.codigo) });
}));

module.exports = router;
