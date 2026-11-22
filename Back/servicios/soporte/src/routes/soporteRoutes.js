const express = require("express");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Rutas del Usuario de Soporte. Todas son de solo lectura sobre otros servicios.
function crearSoporteRoutes({ facturasService, transaccionesService }) {
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

  return router;
}

module.exports = { crearSoporteRoutes };
