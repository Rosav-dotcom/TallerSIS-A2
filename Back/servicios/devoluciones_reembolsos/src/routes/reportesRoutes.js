const { Router } = require("express");
const { obtenerReporte, opcionesDeFiltros } = require("../services/reportesService");
const { generarReporteExcel, nombreArchivo } = require("../services/reportesExcelService");

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

// TDSI-82/1088: "Exportar" baja el Excel (hojas Devoluciones y Notas de credito) con los mismos
// filtros y filas que la vista previa.
router.get("/excel", wrap(async (req, res) => {
  const reporte = await obtenerReporte(req.query);
  const archivo = await generarReporteExcel(reporte);
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${nombreArchivo(reporte.filtros)}"`,
  });
  res.send(archivo);
}));

module.exports = router;
