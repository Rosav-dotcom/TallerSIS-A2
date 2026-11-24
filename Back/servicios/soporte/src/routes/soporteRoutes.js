const express = require("express");

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Rutas del Usuario de Soporte. Todas son de solo lectura sobre otros servicios.
function crearSoporteRoutes({ facturasService, transaccionesService, comparacionService, ticketsService, gestionTicketsService }) {
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

  // TDSI-671: bandeja de tickets, paginada (?pagina=1&limite=20) y ordenada por prioridad
  // TDSI-674: filtros combinables ?numero=&usuario=&desde=&hasta=&estado=&prioridad=
  router.get(
    "/tickets",
    wrap(async (req, res) => {
      const { data, paginacion } = await ticketsService.listarTickets(req.query);
      res.json({ ok: true, data, paginacion });
    })
  );

  // TDSI-209: historial de incidencias de un usuario (?usuario=correo) y usuarios con incidentes (?q=)
  router.get(
    "/historial/usuarios",
    wrap(async (req, res) => res.json({ ok: true, data: await ticketsService.usuariosConIncidentes(req.query) }))
  );
  router.get(
    "/historial",
    wrap(async (req, res) => {
      const { data, resumen } = await ticketsService.historialPorUsuario(req.query);
      res.json({ ok: true, data, resumen });
    })
  );

  // TDSI-668: registrar un ticket (nace Abierto, con número INC-NNNNNN)
  router.post(
    "/tickets",
    wrap(async (req, res) =>
      res.status(201).json({ ok: true, mensaje: "Ticket registrado", data: await ticketsService.crearTicket(req.body, req.usuario) })
    )
  );

  // ---------- TDSI-64: gestionar cada ticket ----------
  // TDSI-677: catálogo de tipos, prioridades y estados
  router.get("/catalogos", (req, res) => res.json({ ok: true, data: gestionTicketsService.catalogos() }));

  // TDSI-677: detalle de un ticket (va después de GET /tickets, que es la bandeja)
  router.get(
    "/tickets/:numero",
    wrap(async (req, res) => res.json({ ok: true, data: await gestionTicketsService.obtenerTicket(req.params.numero) }))
  );

  // TDSI-677: cambiar el tipo
  router.patch(
    "/tickets/:numero/tipo",
    wrap(async (req, res) =>
      res.json({ ok: true, mensaje: "Tipo actualizado", data: await gestionTicketsService.cambiarTipo(req.params.numero, req.body, req.usuario) })
    )
  );

  return router;
}

module.exports = { crearSoporteRoutes };
