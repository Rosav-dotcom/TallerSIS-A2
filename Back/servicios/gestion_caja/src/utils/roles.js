// TDSI-68/992: roles que entran por el login de administracion (/api/auth/login-administrador).
// El Cajero (login con caja) y el Supervisor (PIN, en facturacion) no estan aqui.
const ROLES = {
  ADMINISTRADOR: "Administrador",
  ENCARGADO_DEVOLUCIONES: "Encargado de Devoluciones",
  USUARIO_SOPORTE: "Usuario de Soporte",
};

// Los que el Administrador crea desde la pantalla "Usuarios".
const ROLES_PERSONAL = ["ENCARGADO_DEVOLUCIONES", "USUARIO_SOPORTE"];

const sinTildes = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Acepta el codigo ("USUARIO_SOPORTE") o el nombre ("Usuario de Soporte"); null si no es un rol. */
function normalizarRol(valor) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const limpio = sinTildes(valor.trim()).toUpperCase();
  if (ROLES[limpio]) return limpio;
  return Object.keys(ROLES).find((codigo) => sinTildes(ROLES[codigo]).toUpperCase() === limpio) || null;
}

const nombreRol = (codigo) => ROLES[codigo] || codigo;

module.exports = { ROLES, ROLES_PERSONAL, normalizarRol, nombreRol };
