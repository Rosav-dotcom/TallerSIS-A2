const { Router } = require("express");
const { obtenerReporte, opcionesDeFiltros } = require("../services/reportesService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-82/241: opciones de los filtros (sucursales, estados, motivos y metodos de reembolso).
router.get("/filtros", wrap(async (req, res) => {
  res.json({ ok: true, data: await opcionesDeFiltros() });
}));

// TDSI-82/241: vista previa del reporte de devoluciones y notas de credito.
// ?desde=&hasta= (AAAA-MM-DD, obligatorios) &sucursal= &estado= &motivo_id= &metodo= (EFECTIVO, REVERSION_TARJETA o VALE)
router.get("/", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerReporte(req.query) });
}));

module.exports = router;
