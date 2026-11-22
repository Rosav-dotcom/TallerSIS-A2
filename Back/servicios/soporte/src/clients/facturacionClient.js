const { pedirJson } = require("./http");

// TDSI-1064: cliente de solo lectura hacia facturación (dueño de las facturas).
// Soporte nunca escribe en facturación; solo usa GET /api/facturas/:numero.
function crearFacturacionClient({ baseUrl = process.env.FACTURACION_URL || "http://localhost:4002", fetchImpl } = {}) {
  return {
    async obtenerFactura(numero) {
      const cuerpo = await pedirJson(`${baseUrl}/api/facturas/${encodeURIComponent(numero)}`, {
        servicio: "facturación",
        fetchImpl,
      });
      return cuerpo && cuerpo.data ? cuerpo.data : null;
    },
  };
}

module.exports = { crearFacturacionClient };
