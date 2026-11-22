const { Router } = require("express");
const {
  crearCajero,
  crearPersonal,
  listarUsuarios,
  listarRolesPersonal,
  editarUsuario,
  cambiarPasswordCajero,
  cambiarEstadoUsuario,
} = require("../services/adminUsuariosService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-47/916: lista de cajeros y supervisores para la pantalla "Usuarios".
router.get("/", wrap(async (req, res) => {
  const data = await listarUsuarios();
  res.json({ ok: true, data });
}));

// TDSI-68/992: roles nuevos para el selector "Rol" de "Nuevo usuario".
router.get("/roles", (req, res) => {
  res.json({ ok: true, data: listarRolesPersonal() });
});

// TDSI-68/992: registra un Encargado de Devoluciones o un Usuario de Soporte
// (usuario/contrasena/nombre/rol); entra por el login de administracion con su perfil.
router.post("/personal", wrap(async (req, res) => {
  const cuenta = await crearPersonal(req.body);
  res.status(201).json({ ok: true, mensaje: "Usuario registrado.", data: cuenta });
}));

// TDSI-47/171: el Administrador registra un cajero nuevo (usuario/contrasena).
router.post("/cajeros", wrap(async (req, res) => {
  const cajero = await crearCajero(req.body);
  res.status(201).json({ ok: true, mensaje: "Cajero registrado.", data: cajero });
}));

// TDSI-47/917: "Editar" -- cambia nombre y usuario de un cajero o un supervisor.
router.put("/:id", wrap(async (req, res) => {
  const usuario = await editarUsuario(req.params.id, req.body);
  res.json({ ok: true, data: usuario });
}));

// TDSI-47/917: "Cambiar contrasena" -- cajeros y (TDSI-68/992) Encargados y Usuarios de Soporte.
router.put("/cajeros/:id/password", wrap(async (req, res) => {
  const cajero = await cambiarPasswordCajero(req.params.id, req.body);
  res.json({ ok: true, mensaje: "Contrasena actualizada.", data: cajero });
}));
router.put("/:id/password", wrap(async (req, res) => {
  const usuario = await cambiarPasswordCajero(req.params.id, req.body);
  res.json({ ok: true, mensaje: "Contrasena actualizada.", data: usuario });
}));

// TDSI-47/918: "Activar" / "Desactivar" un cajero o un supervisor.
router.patch("/:id/estado", wrap(async (req, res) => {
  const usuario = await cambiarEstadoUsuario(req.params.id, req.body);
  res.json({ ok: true, data: usuario });
}));

module.exports = router;
