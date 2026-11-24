const { Router } = require("express");
const caja = require("../services/kpisCajaService");
const devSoporte = require("../services/kpisDevolucionesSoporteService");

// TDSI-639: Tablero de KPIs del Administrador (/admin/kpis). Filtros comunes en el query:
// ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (por defecto el mes en curso) &caja_id= &cajero_id=
// Todas las rutas piden el token del Administrador (se montan con requireAdministrador).
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// ---------- pestaña "Caja" ----------
router.get("/caja", wrap(async (req, res) => {
  res.json({ ok: true, data: await caja.pestanaCaja(req.query) });
}));

// TDSI-643: KPI-3 Exactitud de arqueo
router.get("/caja/exactitud-arqueo", wrap(async (req, res) => {
  res.json({ ok: true, data: await caja.exactitudArqueo(req.query) });
}));

// TDSI-1090: KPI-4 Tiempo de autorizacion
router.get("/caja/tiempo-autorizacion", wrap(async (req, res) => {
  res.json({ ok: true, data: await caja.tiempoAutorizacion(req.query) });
}));

// TDSI-644: KPI-7 Monto de diferencias de caja
router.get("/caja/diferencias", wrap(async (req, res) => {
  res.json({ ok: true, data: await caja.diferencias(req.query) });
}));

// ---------- pestaña "Devoluciones y soporte" (TDSI-1130) ----------
// Soporte pide el token del Administrador: se le reenvia el mismo Authorization.
router.get("/devoluciones-soporte", wrap(async (req, res) => {
  res.json({ ok: true, data: await devSoporte.pestanaDevolucionesSoporte(req.query, req.headers.authorization) });
}));

// KPI-9 Tasa de devoluciones (lee Devoluciones y Gestion de pagos)
router.get("/devoluciones-soporte/tasa-devoluciones", wrap(async (req, res) => {
  res.json({ ok: true, data: await devSoporte.tasaDevoluciones(req.query) });
}));

// KPI-10 Tiempo de resolucion de soporte (lee Soporte)
router.get("/devoluciones-soporte/resolucion-soporte", wrap(async (req, res) => {
  res.json({ ok: true, data: await devSoporte.resolucionSoporte(req.query, req.headers.authorization) });
}));

module.exports = router;
