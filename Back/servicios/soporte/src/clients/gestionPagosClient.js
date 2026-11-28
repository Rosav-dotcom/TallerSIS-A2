const { pedirJson } = require("./http");
const { AppError } = require("../utils/AppError");

const MARGEN_RENOVACION_MS = 30 * 1000; // renueva el token 30 s antes de que venza

// TDSI-1066: cliente de solo lectura hacia gestion_pagos (dueño de las transacciones).
// Las rutas de transacciones piden el token del Sistema Cliente: Soporte se registra
// como cliente ("soporte") y pide el token con POST /auth/token. El token se guarda
// en memoria y se reutiliza hasta poco antes de vencer.
function crearGestionPagosClient({
  baseUrl = process.env.GESTION_PAGOS_URL || "http://localhost:4005",
  clientId = process.env.GESTION_PAGOS_CLIENT_ID,
  clientSecret = process.env.GESTION_PAGOS_CLIENT_SECRET,
  fetchImpl,
  ahora = () => Date.now(),
} = {}) {
  let token = null; // { valor, venceEn }

  async function obtenerToken() {
    if (token && token.venceEn - MARGEN_RENOVACION_MS > ahora()) return token.valor;
    if (!clientId || !clientSecret) {
      throw new AppError(
        "Soporte no tiene credenciales para gestion_pagos",
        503,
        "Configure GESTION_PAGOS_CLIENT_ID y GESTION_PAGOS_CLIENT_SECRET en el .env"
      );
    }
    const cuerpo = await pedirJson(`${baseUrl}/auth/token`, {
      servicio: "gestion_pagos",
      fetchImpl,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    }).catch((e) => {
      // Credenciales rechazadas: es un problema de configuración de Soporte, no del usuario
      if (e.statusOrigen === 401) throw new AppError("gestion_pagos rechazó las credenciales de Soporte", 503, e.detalle);
      throw e;
    });
    const data = cuerpo && cuerpo.data;
    if (!data || !data.access_token) throw new AppError("gestion_pagos no devolvió un token", 502);
    token = { valor: data.access_token, venceEn: ahora() + Number(data.expires_in || 0) * 1000 };
    return token.valor;
  }

  // GET con token. Si gestion_pagos rechaza el token (401: vencido o revocado),
  // se descarta, se pide uno nuevo y se reintenta una sola vez.
  async function getConToken(ruta, reintentar = true) {
    const valor = await obtenerToken();
    try {
      return await pedirJson(`${baseUrl}${ruta}`, {
        servicio: "gestion_pagos",
        fetchImpl,
        headers: { Authorization: `Bearer ${valor}` },
      });
    } catch (e) {
      if (reintentar && e.statusOrigen === 401) {
        token = null;
        return getConToken(ruta, false);
      }
      throw e;
    }
  }

  return {
    async obtenerTransaccion(id) {
      const cuerpo = await getConToken(`/transacciones/${encodeURIComponent(id)}`);
      return cuerpo && cuerpo.data ? cuerpo.data : null;
    },
    async obtenerHistorial(id) {
      const cuerpo = await getConToken(`/transacciones/${encodeURIComponent(id)}/historial`);
      return (cuerpo && cuerpo.data) || [];
    },
  };
}

module.exports = { crearGestionPagosClient };
