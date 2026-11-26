const { Router } = require("express");
const { crearKpisVentasService } = require("../services/kpisVentasService");

// TDSI-650 (TDSI-640): pestaña "Ventas" del Tablero de KPIs del Administrador (/admin/kpis).
// GET /api/kpis/ventas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&caja_id=&cajero_id=
// (sin fechas: el mes en curso hasta hoy). Detalle de cada KPI: docs/kpis-ventas.md
function crearKpisVentasRoutes(service = crearKpisVentasService()) {
  const router = Router();
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

  router.get("/ventas", wrap(async (req, res) => {
    res.json({ ok: true, data: await service.kpisVentas(req.query) });
  }));

  return router;
}

module.exports = { crearKpisVentasRoutes };
