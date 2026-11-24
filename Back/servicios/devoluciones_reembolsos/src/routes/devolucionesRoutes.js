const { Router } = require("express");
const {
  listarDevoluciones, obtenerDevolucion, obtenerHistorial, devolucionesDelDia,
} = require("../services/devolucionesService");
const { registrarDevolucion } = require("../services/registroService");
const { rechazarDevolucion } = require("../services/rechazoService");
const { emitirNotaCreditoDeDevolucion } = require("../services/notaCreditoService");
const { procesarDevolucion } = require("../services/procesoService");
const { reenviar: reenviarAInventario } = require("../services/inventarioService");
const { normalizarCodigo } = require("../utils/codigoDevolucion");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-76/1112: lista de devoluciones; ?codigo= busca por su codigo DEV- (acepta "dev-123" o "123").
// TDSI-70: filtros ?estado= (PENDIENTE, APROBADA, RECHAZADA, PROCESADA) y ?desde=&hasta= (AAAA-MM-DD).
// No hay PUT/PATCH del codigo: es unico y no se edita (TDSI-1111).
router.get("/", wrap(async (req, res) => {
  const { codigo, estado, desde, hasta } = req.query;
  res.json({ ok: true, data: await listarDevoluciones({ codigo, estado, desde, hasta }) });
}));

// TDSI-80/1069: devoluciones del dia (sin rechazadas) para el resumen por caja de gestion_caja.
// Va antes de /:codigo para que "del-dia" no se lea como un codigo DEV-.
router.get("/del-dia", wrap(async (req, res) => {
  res.json({ ok: true, data: await devolucionesDelDia({ fecha: req.query.fecha }) });
}));

// TDSI-70/1001: registra una devolucion total o parcial con los items y cantidades elegidos.
router.post("/", wrap(async (req, res) => {
  const devolucion = await registrarDevolucion(req.body);
  res.status(201).json({ ok: true, mensaje: `Devolución ${devolucion.codigo} registrada.`, data: devolucion });
}));

// TDSI-78/233: rechazar una solicitud no procedente. Cuerpo: { motivo, usuario }.
router.post("/:codigo/rechazo", wrap(async (req, res) => {
  const devolucion = await rechazarDevolucion(req.params.codigo, req.body);
  res.json({ ok: true, mensaje: `Devolución ${devolucion.codigo} rechazada.`, data: devolucion });
}));

// TDSI-73/1016: "Emitir nota de credito" de la confirmacion. Cuerpo: { usuario }. La nota (y su PDF)
// la emite Facturacion; aqui queda su numero.
router.post("/:codigo/nota-credito", wrap(async (req, res) => {
  const nota = await emitirNotaCreditoDeDevolucion(req.params.codigo, req.body);
  res.status(201).json({ ok: true, mensaje: `Nota de crédito ${nota.numero} emitida.`, data: nota });
}));

// TDSI-77/231: procesar la devolucion y avisar a Inventario. Cuerpo: { usuario }.
router.post("/:codigo/procesar", wrap(async (req, res) => {
  const devolucion = await procesarDevolucion(req.params.codigo, req.body);
  res.json({ ok: true, mensaje: `Devolución ${devolucion.codigo} procesada.`, data: devolucion });
}));

// TDSI-77/1041: "Reenviar" el aviso a Inventario (en Error o Rechazado). Responde el detalle.
router.post("/:codigo/inventario/reenviar", wrap(async (req, res) => {
  const codigo = normalizarCodigo(req.params.codigo);
  const devolucion = await obtenerDevolucion(codigo || req.params.codigo); // 404 si no existe
  await reenviarAInventario(devolucion.codigo);
  const actualizada = await obtenerDevolucion(devolucion.codigo);
  res.json({ ok: true, mensaje: `Aviso de ${devolucion.codigo} reenviado a Inventario.`, data: actualizada });
}));

// TDSI-81/1057: linea de tiempo (historial de estados con usuario y hora). Solo lectura.
router.get("/:codigo/historial", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerHistorial(req.params.codigo) });
}));

// TDSI-76/1112: detalle de una devolucion por su codigo (ruta /devoluciones/:codigo del Front).
router.get("/:codigo", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerDevolucion(req.params.codigo) });
}));

module.exports = router;
