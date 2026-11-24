const { Router } = require("express");
const notas = require("../services/notasCreditoService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-73/1016: emitir la nota de credito vinculada a la factura original.
router.post("/", wrap(async (req, res) => {
  const { nota, contabilidad } = await notas.emitirNotaCredito(req.body);
  // TDSI-73/1018: como POST /api/facturas, tambien el resultado del envio a Contabilidad
  res.status(201).json({ ok: true, mensaje: `Nota de crédito ${nota.numero} emitida.`, data: nota, contabilidad });
}));

// Notas de una factura: ?factura=F-000123
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await notas.listarNotasCredito({ factura: req.query.factura }) });
}));

// TDSI-73/1024: descargar en PDF (mismo formato que la factura, TDSI-13)
router.get("/:numero/pdf", wrap(async (req, res) => {
  const { numero, pdf } = await notas.pdfNotaCredito(req.params.numero);
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${numero}.pdf"` });
  res.send(pdf);
}));

// TDSI-73/1022: la nota con la factura original a la que pertenece
router.get("/:numero", wrap(async (req, res) => {
  res.json({ ok: true, data: await notas.obtenerNotaCredito(req.params.numero) });
}));

module.exports = router;
