// TDSI-665 (TDSI-66): solo el Usuario de Soporte y el Administrador usan Soporte.
// El token es el access_token que devuelve el login de administracion (gestion_caja,
// /api/auth/login-administrador). Soporte no guarda cuentas: le pregunta el rol a
// gestion_caja (GET /api/auth/perfil) y guarda la respuesta un momento para no
// consultarla en cada pedido. Deja en req.usuario { usuario_id, email, nombre, rol }.
//
//   401  sin token, token inválido o vencido
//   403  la cuenta no tiene un rol permitido, o está desactivada
//   503  gestion_caja no responde (no se puede saber el rol)

const CACHE_MS = 60 * 1000;
const CACHE_MAX = 500;

const responder = (res, status, mensaje) => res.status(status).json({ ok: false, mensaje, detalle: null });

function crearRequireRol({ cajaClient, cacheMs = CACHE_MS, ahora = () => Date.now() }) {
  const cache = new Map(); // authorization -> { perfil, vence }

  async function perfilDe(authorization) {
    const guardado = cache.get(authorization);
    if (guardado && guardado.vence > ahora()) return guardado.perfil;

    const perfil = await cajaClient.obtenerPerfil(authorization);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(authorization, { perfil, vence: ahora() + cacheMs });
    return perfil;
  }

  return function requireRol(...roles) {
    return async function verificarRol(req, res, next) {
      const authorization = req.headers.authorization || "";
      const [esquema, token] = authorization.split(" ");
      if (esquema !== "Bearer" || !token) return responder(res, 401, "Token de acceso requerido");

      let perfil;
      try {
        perfil = await perfilDe(authorization);
      } catch (e) {
        if (e.statusOrigen === 401) return responder(res, 401, "Token inválido o vencido");
        if (e.statusOrigen === 403) return responder(res, 403, e.detalle || "Su cuenta no tiene acceso a Soporte.");
        if (e.status === 503 || e.status === 502) {
          return res.status(503).json({ ok: false, mensaje: "No se pudo verificar el perfil en este momento.", detalle: e.message });
        }
        return next(e);
      }

      if (!perfil || !roles.includes(perfil.rol)) {
        return responder(res, 403, "Solo el Usuario de Soporte y el Administrador pueden usar Soporte.");
      }
      req.usuario = perfil;
      next();
    };
  };
}

module.exports = { crearRequireRol, ROLES_SOPORTE: ["USUARIO_SOPORTE", "ADMINISTRADOR"] };
