const administradoresRepo = require("../data/administradoresRepo");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function noAutorizado(res, mensaje) {
  return res.status(401).json({ ok: false, mensaje });
}

/**
 * TDSI-68/992: valida el access_token de Supabase Auth del que llama (el mismo que devuelve
 * /api/auth/login-administrador) y que sea una cuenta activa de caja.administradores con
 * alguno de los roles permitidos. Deja en req.administrador { administrador_id, nombre, rol }.
 */
function requireRol(...roles) {
  return async function verificarRol(req, res, next) {
    const [esquema, token] = (req.headers.authorization || "").split(" ");
    if (esquema !== "Bearer" || !token) {
      return noAutorizado(res, "Token de acceso requerido");
    }

    let usuario;
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return noAutorizado(res, "Token invalido o vencido");
      usuario = await r.json();
    } catch (e) {
      return next(e);
    }

    try {
      const cuenta = await administradoresRepo.buscarPorCajeroId(usuario.id);
      const rol = cuenta ? cuenta.rol || "ADMINISTRADOR" : null;
      if (!cuenta || !cuenta.activo || !roles.includes(rol)) {
        const mensaje = roles.length === 1 && roles[0] === "ADMINISTRADOR"
          ? "Esta accion requiere permisos de Administrador."
          : "Su perfil no tiene permiso para esta accion.";
        return res.status(403).json({ ok: false, mensaje });
      }
      req.administrador = { administrador_id: usuario.id, nombre: cuenta.nombre, rol };
      next();
    } catch (e) {
      next(e);
    }
  };
}

/**
 * TDSI-47/919: "Solo el Administrador gestiona las cuentas". TDSI-992: con los roles
 * nuevos en la misma tabla, ya no alcanza con estar en caja.administradores: el rol
 * tiene que ser ADMINISTRADOR (un Encargado de Devoluciones no gestiona usuarios).
 */
const requireAdministrador = requireRol("ADMINISTRADOR");

module.exports = { requireAdministrador, requireRol };
