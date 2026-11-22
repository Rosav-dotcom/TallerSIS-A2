const { AppError } = require("../utils/AppError");
const { autenticarCajero } = require("./authService");
const administradoresRepo = require("./../data/administradoresRepo");
const { normalizarRol, nombreRol } = require("../utils/roles");

/**
 * Login de Administrador: usa el mismo Supabase Auth que el cajero (autenticarCajero
 * ya es generico, solo valida email/password), pero en vez de exigir caja_id y abrir
 * una sesion de terminal, verifica que ese usuario este habilitado como administrador.
 *
 * TDSI-68/992: el mismo login sirve para los perfiles "Encargado de Devoluciones" y
 * "Usuario de Soporte". "rol" es la pestana "Perfil de acceso" elegida (codigo o nombre);
 * sin rol se pide Administrador, como antes. La cuenta tiene que tener ESE rol.
 */
async function autenticarAdministrador({ email, password, rol } = {}) {
  const rolPedido = rol === undefined || rol === null || rol === "" ? "ADMINISTRADOR" : normalizarRol(rol);
  if (!rolPedido) throw new AppError("El perfil de acceso no es valido.", 400, { rol });

  const usuario = await autenticarCajero({ email, password });

  const cuenta = await administradoresRepo.buscarPorCajeroId(usuario.cajero_id);
  if (!cuenta || (cuenta.rol || "ADMINISTRADOR") !== rolPedido) {
    const mensaje = rolPedido === "ADMINISTRADOR"
      ? "Este usuario no tiene permisos de administrador."
      : `Este usuario no tiene el perfil ${nombreRol(rolPedido)}.`;
    throw new AppError(mensaje, 403);
  }
  // Mismo mensaje que el cajero desactivado (TDSI-47/918): el Administrador la reactiva en "Usuarios".
  if (!cuenta.activo) {
    throw new AppError("Esta cuenta esta desactivada. Contacte al Administrador.", 403);
  }

  return {
    administrador_id: usuario.cajero_id,
    email: usuario.email,
    nombre: cuenta.nombre || usuario.email,
    rol: rolPedido,
    rol_nombre: nombreRol(rolPedido),
    access_token: usuario.access_token,
  };
}

module.exports = { autenticarAdministrador };
