const express = require("express");
const cors = require("cors");
const { errorHandler } = require("./middlewares/errorHandler");
const { query } = require("./config/db");

// TDSI-213: la app se arma aparte de index.js para poder probarla sin abrir el puerto.
const app = express();

app.use(cors());
app.use(express.json());

app.get("/devoluciones", (req, res) => {
  res.json({
    mensaje: "Microservicio de Devoluciones y reembolsos funcionando",
    estado: "activo",
  });
});

// Verifica la conexion a PostgreSQL y que exista el esquema "devoluciones".
app.get("/health", async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'devoluciones') AS esquema"
    );
    if (!rows[0].esquema) {
      return res.status(503).json({ ok: false, db: "up", esquema: "falta", mensaje: "Corra sql/script_devoluciones.sql" });
    }
    res.json({ ok: true, db: "up", esquema: "devoluciones" });
  } catch (e) {
    res.status(503).json({ ok: false, db: "down", mensaje: e.message });
  }
});

app.use("/api/devoluciones/comprobantes", require("./routes/comprobantesRoutes")); // TDSI-68/991
app.use("/api/devoluciones/configuracion", require("./routes/configuracionRoutes")); // TDSI-69/1097
app.use("/api/devoluciones/motivos", require("./routes/motivosRoutes")); // TDSI-71/1102
app.use("/api/devoluciones/reportes", require("./routes/reportesRoutes")); // TDSI-82/241
// Despues de /comprobantes y /reportes, para que no se lean como un codigo DEV-.
app.use("/api/devoluciones", require("./routes/devolucionesRoutes")); // TDSI-76/1112

app.use(errorHandler);

module.exports = app;
