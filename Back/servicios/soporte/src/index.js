require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");
const { crearFacturacionClient } = require("./clients/facturacionClient");
const { crearFacturasService } = require("./services/facturasService");
const { crearGestionPagosClient } = require("./clients/gestionPagosClient");
const { crearTransaccionesService } = require("./services/transaccionesService");
const { crearComparacionService } = require("./services/comparacionService");
const { crearSoporteRoutes } = require("./routes/soporteRoutes");
const { crearTicketsService } = require("./services/ticketsService");
const ticketsRepo = require("./data/ticketsRepo");
const { crearGestionTicketsService } = require("./services/gestionTicketsService");
const gestionTicketsRepo = require("./data/gestionTicketsRepo");
const { crearGestionCajaClient } = require("./clients/gestionCajaClient");
const { crearRequireRol, ROLES_SOPORTE } = require("./middlewares/requireRol");

// TDSI-203: microservicio de Soporte (Sprint 4, Equipo 2). Atiende los reclamos de
// facturas y pagos: consulta en solo lectura lo que guardan Facturación y Gestión de
// pagos, y registra los incidentes en su propio esquema "soporte".
const app = express();
const port = process.env.PORT || 4007;

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ ok: true, servicio: "soporte", db: "up" });
  } catch (e) {
    res.status(503).json({ ok: false, servicio: "soporte", db: "down", mensaje: e.message });
  }
});

// Dependencias armadas aquí para poder reemplazarlas en los tests
const facturasService = crearFacturasService({ facturacionClient: crearFacturacionClient() });
const transaccionesService = crearTransaccionesService({ gestionPagosClient: crearGestionPagosClient() });
const comparacionService = crearComparacionService({ facturasService, transaccionesService });
const ticketsService = crearTicketsService({ repo: ticketsRepo });
const gestionTicketsService = crearGestionTicketsService({ repo: gestionTicketsRepo });
// TDSI-665: todo /api/soporte pide el token del login de administracion con rol
// USUARIO_SOPORTE o ADMINISTRADOR (/health queda libre para docker y monitoreo)
const requireRol = crearRequireRol({ cajaClient: crearGestionCajaClient() });
app.use(
  "/api/soporte",
  requireRol(...ROLES_SOPORTE),
  crearSoporteRoutes({ facturasService, transaccionesService, comparacionService, ticketsService, gestionTicketsService })
);

app.use(errorHandler);

// Se exporta la app para los tests; el servidor solo arranca al ejecutar este archivo.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Microservicio de Soporte corriendo en el puerto ${port}`);
  });
}

module.exports = { app };
