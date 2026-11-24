require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 4008;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Devoluciones y reembolsos ejecutandose en el puerto ${PORT}`);
  require("./jobs/reintentoInventario").iniciar(); // TDSI-77/1039
  require("./jobs/acusesInventario").iniciar(); // TDSI-77/1040
});
