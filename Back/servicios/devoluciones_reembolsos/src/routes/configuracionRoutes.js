const { Router } = require("express");
const { obtenerPlazoDias, obtenerLimiteAutorizacion } = require("../services/configuracionService");

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// TDSI-69/1097: plazo de devolucion vigente (dias habiles). Se cambia en devoluciones.configuracion.
router.get("/plazo", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerPlazoDias() });
}));

// TDSI-80/237: monto limite (Bs) desde el cual hace falta el usuario y PIN de un supervisor;
// la pantalla lo usa para mostrar "Requiere autorizacion del Supervisor" antes de registrar.
router.get("/limite-autorizacion", wrap(async (req, res) => {
  res.json({ ok: true, data: await obtenerLimiteAutorizacion() });
}));

module.exports = router;
