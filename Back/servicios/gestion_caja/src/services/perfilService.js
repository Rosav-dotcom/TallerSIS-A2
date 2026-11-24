const { AppError } = require("../utils/AppError");
const { query } = require("../config/db");

// TDSI-665 (TDSI-66): perfil de la cuenta que inicio sesion por el login de administracion.
// Lo usan otros microservicios (Soporte) para saber el ROL del que llama sin leer
// caja.administradores directamente: un dato, un dueño (las cuentas son de gestion_caja).
// El rol lo guarda TDSI-992 en caja.administradores.rol; una fila sin rol es ADMINISTRADOR.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function obtenerPerfil(authorization, { fetchImpl = fetch } = {}) {
  const [esquema, token] = String(authorization || "").split(" ");
  if (esquema !== "Bearer" || !token) throw new AppError("Token de acceso requerido", 401);

  let respuesta;
  try {
    respuesta = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new AppError("No se pudo validar la sesion en este momento.", 503, e.message);
  }
  if (!respuesta.ok) throw new AppError("Token invalido o vencido", 401);
  const usuario = await respuesta.json();

  // SELECT *: trae "rol" si la columna ya existe (TDSI-992) y funciona igual si todavia no
  const { rows } = await query("SELECT * FROM caja.administradores WHERE cajero_id = $1", [usuario.id]);
  const cuenta = rows[0] || null;
  if (!cuenta) throw new AppError("Esta cuenta no tiene un perfil de administracion.", 403);
  if (!cuenta.activo) throw new AppError("Esta cuenta esta desactivada. Contacte al Administrador.", 403);

  return {
    usuario_id: usuario.id,
    email: usuario.email,
    nombre: cuenta.nombre || usuario.email,
    rol: cuenta.rol || "ADMINISTRADOR",
  };
}

module.exports = { obtenerPerfil };
