const { pedirJson } = require("./http");

// TDSI-665: cliente hacia gestion_caja, dueño de las cuentas y sus roles (TDSI-992).
// GET /api/auth/perfil recibe el mismo token del login de administracion y responde
// { usuario_id, email, nombre, rol }.
function crearGestionCajaClient({ baseUrl = process.env.GESTION_CAJA_URL || "http://localhost:4004", fetchImpl } = {}) {
  return {
    async obtenerPerfil(authorization) {
      const cuerpo = await pedirJson(`${baseUrl}/api/auth/perfil`, {
        servicio: "gestion_caja",
        fetchImpl,
        headers: { Authorization: authorization },
      });
      return cuerpo && cuerpo.data ? cuerpo.data : null;
    },
  };
}

module.exports = { crearGestionCajaClient };
