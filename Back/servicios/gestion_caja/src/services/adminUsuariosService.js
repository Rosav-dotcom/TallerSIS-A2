const { AppError } = require("../utils/AppError");
const cajerosRepo = require("../data/cajerosRepo");
const administradoresRepo = require("../data/administradoresRepo");
const { ROLES_PERSONAL, normalizarRol, nombreRol } = require("../utils/roles");
const { listarSupervisores, editarSupervisor, cambiarEstadoSupervisor } = require("./supervisorProxy");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * TDSI-47/171: crea la cuenta de login en Supabase Auth -- ahi se guarda la
 * contrasena (encriptada, nunca en nuestra BD), igual que con el login que ya
 * existe hoy. Requiere SUPABASE_SERVICE_ROLE_KEY (API de administracion).
 */
async function crearCuentaSupabase({ email, password }) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const datos = await r.json();
  if (!r.ok) {
    const mensaje = datos.msg || datos.error_description || datos.message || "No se pudo crear la cuenta.";
    if (r.status === 422 && /already.*registered|already exists/i.test(mensaje)) {
      throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
    }
    throw new AppError(mensaje, r.status >= 400 && r.status < 500 ? 400 : 502);
  }
  return datos;
}

/**
 * TDSI-47/917: PUT /auth/v1/admin/users/:id generico (cambia email y/o contrasena).
 */
async function actualizarCuentaSupabase(cajero_id, payload) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${cajero_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const datos = await r.json();
  if (!r.ok) {
    const mensaje = datos.msg || datos.error_description || datos.message || "No se pudo actualizar la cuenta.";
    if (r.status === 422 && /already.*registered|already exists/i.test(mensaje)) {
      throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: payload.email });
    }
    throw new AppError(mensaje, r.status >= 400 && r.status < 500 ? 400 : 502);
  }
  return datos;
}

function aPublico(cajero) {
  return {
    id: cajero.cajero_id,
    cajero_id: cajero.cajero_id,
    usuario: cajero.usuario,
    nombre: cajero.nombre,
    rol: "Cajero",
    estado: cajero.activo ? "Activo" : "Inactivo",
  };
}

/** TDSI-68/992: fila de la pantalla "Usuarios" para un Encargado de Devoluciones o un Usuario de Soporte. */
function personalAPublico(cuenta) {
  return {
    id: cuenta.cajero_id,
    cajero_id: cuenta.cajero_id,
    usuario: cuenta.usuario,
    nombre: cuenta.nombre,
    rol: nombreRol(cuenta.rol),
    rol_codigo: cuenta.rol,
    estado: cuenta.activo ? "Activo" : "Inactivo",
  };
}

/** Una cuenta de caja.administradores de los roles nuevos (no un Administrador). */
async function buscarPersonal(cajero_id) {
  const cuenta = await administradoresRepo.buscarPorCajeroId(cajero_id);
  return cuenta && ROLES_PERSONAL.includes(cuenta.rol) ? cuenta : null;
}

/** Un usuario (correo) no se puede repetir entre cajeros y cuentas del login de administracion. */
async function usuarioRegistrado(email) {
  const [cajero, cuenta] = await Promise.all([
    cajerosRepo.buscarPorUsuario(email),
    administradoresRepo.buscarPorUsuario(email),
  ]);
  return Boolean(cajero || cuenta);
}

/**
 * TDSI-47/171: el Administrador registra un cajero nuevo. "usuario" es el
 * correo con el que va a iniciar sesion (igual que hoy); la contrasena la
 * pone el Administrador y Supabase la guarda encriptada, nunca se vuelve a
 * mostrar. El nombre/usuario/estado del cajero se guardan en caja.cajeros,
 * con el mismo patron que caja.administradores.
 */
async function crearCajero({ usuario, password, nombre }) {
  if (!usuario || !EMAIL_REGEX.test(String(usuario).trim())) {
    throw new AppError("El usuario debe ser un correo valido.", 400);
  }
  if (!password || String(password).length < 6) {
    throw new AppError("La contrasena debe tener al menos 6 caracteres.", 400);
  }
  if (!nombre || !String(nombre).trim()) {
    throw new AppError("El nombre es obligatorio.", 400);
  }

  const email = String(usuario).trim().toLowerCase();

  if (await usuarioRegistrado(email)) {
    throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
  }

  const cuenta = await crearCuentaSupabase({ email, password });
  const cajero = await cajerosRepo.crear({ cajero_id: cuenta.id, usuario: email, nombre: String(nombre).trim() });
  return aPublico(cajero);
}

/**
 * TDSI-68/992: el Administrador registra un Encargado de Devoluciones o un Usuario de
 * Soporte. Igual que un cajero: la cuenta (usuario/contrasena) vive en Supabase Auth y
 * aqui se guarda el perfil, en caja.administradores con su rol, para que entre por el
 * login de administracion con la pestana de su perfil.
 */
async function crearPersonal({ usuario, password, nombre, rol } = {}) {
  const codigo = normalizarRol(rol);
  if (!codigo || !ROLES_PERSONAL.includes(codigo)) {
    throw new AppError(`El rol debe ser ${ROLES_PERSONAL.map(nombreRol).join(" o ")}.`, 400, { rol });
  }
  if (!usuario || !EMAIL_REGEX.test(String(usuario).trim())) {
    throw new AppError("El usuario debe ser un correo valido.", 400);
  }
  if (!password || String(password).length < 6) {
    throw new AppError("La contrasena debe tener al menos 6 caracteres.", 400);
  }
  if (!nombre || !String(nombre).trim()) {
    throw new AppError("El nombre es obligatorio.", 400);
  }

  const email = String(usuario).trim().toLowerCase();
  if (await usuarioRegistrado(email)) {
    throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
  }

  const cuenta = await crearCuentaSupabase({ email, password });
  const creada = await administradoresRepo.crear({
    cajero_id: cuenta.id, usuario: email, nombre: String(nombre).trim(), rol: codigo,
  });
  return personalAPublico(creada);
}

/**
 * TDSI-47/916: lista unificada para la pantalla "Usuarios" -- cajeros (perfil local
 * en caja.cajeros) y supervisores (vía proxy a facturacion), sin contrasenas ni PIN.
 * El filtro por rol lo hace el Front sobre esta misma lista.
 */
async function listarUsuarios() {
  const [cajeros, supervisores, personal] = await Promise.all([
    cajerosRepo.listar(),
    listarSupervisores(),
    administradoresRepo.listarPorRoles(ROLES_PERSONAL), // TDSI-68/992
  ]);

  const filasCajeros = cajeros.map((c) => ({
    id: c.cajero_id,
    usuario: c.usuario,
    nombre: c.nombre,
    rol: "Cajero",
    estado: c.activo ? "Activo" : "Inactivo",
  }));
  const filasSupervisores = supervisores.map((s) => ({
    id: s.id,
    usuario: s.usuario,
    nombre: s.nombre,
    rol: "Supervisor",
    estado: s.estado,
  }));

  return [...filasCajeros, ...filasSupervisores, ...personal.map(personalAPublico)];
}

/**
 * TDSI-47/917: "Editar" en la pantalla "Usuarios" -- cambia nombre y usuario,
 * para un cajero o un supervisor (el id de la fila alcanza para distinguirlos:
 * si existe como cajero_id en caja.cajeros, es un cajero; si no, se intenta
 * como id de supervisor en facturacion).
 */
async function editarUsuario(id, { usuario, nombre } = {}) {
  const cajero = await cajerosRepo.buscarPorCajeroId(id);
  if (cajero) {
    if (!usuario || !EMAIL_REGEX.test(String(usuario).trim())) {
      throw new AppError("El usuario debe ser un correo valido.", 400);
    }
    if (!nombre || !String(nombre).trim()) {
      throw new AppError("El nombre es obligatorio.", 400);
    }

    const email = String(usuario).trim().toLowerCase();
    if (email !== cajero.usuario) {
      if (await usuarioRegistrado(email)) throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
      await actualizarCuentaSupabase(id, { email });
    }

    const actualizado = await cajerosRepo.actualizar(id, { usuario: email, nombre: String(nombre).trim() });
    return aPublico(actualizado);
  }

  // TDSI-68/992: Encargado de Devoluciones o Usuario de Soporte (mismas reglas que un cajero)
  const personal = await buscarPersonal(id);
  if (personal) {
    if (!usuario || !EMAIL_REGEX.test(String(usuario).trim())) {
      throw new AppError("El usuario debe ser un correo valido.", 400);
    }
    if (!nombre || !String(nombre).trim()) {
      throw new AppError("El nombre es obligatorio.", 400);
    }

    const email = String(usuario).trim().toLowerCase();
    if (email !== personal.usuario) {
      if (await usuarioRegistrado(email)) throw new AppError("Ese usuario ya esta registrado.", 409, { usuario: email });
      await actualizarCuentaSupabase(id, { email });
    }

    const actualizado = await administradoresRepo.actualizar(id, { usuario: email, nombre: String(nombre).trim() });
    return personalAPublico(actualizado);
  }

  return editarSupervisor(id, { usuario, nombre });
}

/**
 * TDSI-47/917: "Cambiar contrasena" -- para las cuentas con login de Supabase Auth: cajeros
 * y (TDSI-68/992) Encargados de Devoluciones y Usuarios de Soporte. Los supervisores usan PIN.
 */
async function cambiarPasswordCajero(cajero_id, { password } = {}) {
  if (!password || String(password).length < 6) {
    throw new AppError("La contrasena debe tener al menos 6 caracteres.", 400);
  }

  const cajero = await cajerosRepo.buscarPorCajeroId(cajero_id);
  const personal = cajero ? null : await buscarPersonal(cajero_id);
  if (!cajero && !personal) throw new AppError("Usuario no encontrado.", 404);

  await actualizarCuentaSupabase(cajero_id, { password });
  return cajero ? aPublico(cajero) : personalAPublico(personal);
}

/**
 * TDSI-47/918: "Activar" / "Desactivar" en la pantalla "Usuarios" -- para un cajero
 * o un supervisor (mismo criterio que editarUsuario). Un cajero desactivado no
 * puede volver a iniciar sesion (ver authService.autenticarCajero).
 */
async function cambiarEstadoUsuario(id, { activo } = {}) {
  if (typeof activo !== "boolean") {
    throw new AppError("El campo 'activo' es obligatorio y debe ser true o false.", 400);
  }

  const cajero = await cajerosRepo.buscarPorCajeroId(id);
  if (cajero) {
    const actualizado = await cajerosRepo.cambiarEstado(id, activo);
    return aPublico(actualizado);
  }

  // TDSI-68/992: un Encargado o Usuario de Soporte desactivado ya no entra por el login
  if (await buscarPersonal(id)) {
    const actualizado = await administradoresRepo.cambiarEstado(id, activo);
    return personalAPublico(actualizado);
  }

  return cambiarEstadoSupervisor(id, activo);
}

/** TDSI-68/992: roles que puede elegir el Administrador en "Nuevo usuario" (sin Cajero ni Supervisor). */
function listarRolesPersonal() {
  return ROLES_PERSONAL.map((codigo) => ({ codigo, nombre: nombreRol(codigo) }));
}

module.exports = {
  crearCajero,
  crearPersonal,
  listarUsuarios,
  listarRolesPersonal,
  editarUsuario,
  cambiarPasswordCajero,
  cambiarEstadoUsuario,
};
