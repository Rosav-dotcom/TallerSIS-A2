const { Router } = require("express");
const caja = require("../services/kpisCajaService");

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

module.exports = router;
