require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");
const { crearFacturacionClient } = require("./clients/facturacionClient");
const { crearFacturasService } = require("./services/facturasService");
const { crearSoporteRoutes } = require("./routes/soporteRoutes");

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
app.use("/api/soporte", crearSoporteRoutes({ facturasService }));

app.use(errorHandler);

// Se exporta la app para los tests; el servidor solo arranca al ejecutar este archivo.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Microservicio de Soporte corriendo en el puerto ${port}`);
  });
}

module.exports = { app };
