const express = require("express");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Rutas del Usuario de Soporte. Todas son de solo lectura sobre otros servicios.
function crearSoporteRoutes({ facturasService, transaccionesService, comparacionService }) {
  const router = express.Router();

  // TDSI-1064: consultar una factura (solo lectura, vía facturación)
  router.get(
    "/facturas/:numero",
    wrap(async (req, res) => res.json({ ok: true, data: await facturasService.consultarFactura(req.params.numero) }))
  );

  // TDSI-1066: consultar una transacción con su historial (solo lectura, vía gestion_pagos)
  router.get(
    "/transacciones/:id",
    wrap(async (req, res) => res.json({ ok: true, data: await transaccionesService.consultarTransaccion(req.params.id) }))
  );

  // TDSI-972: comparar factura y transacción y marcar diferencias
  // GET /api/soporte/comparacion?factura=F-000123&transaccion=TX-1 (transaccion es opcional)
  router.get(
    "/comparacion",
    wrap(async (req, res) =>
      res.json({ ok: true, data: await comparacionService.comparar({ factura: req.query.factura, transaccion: req.query.transaccion }) })
    )
  );

  return router;
}

module.exports = { crearSoporteRoutes };
