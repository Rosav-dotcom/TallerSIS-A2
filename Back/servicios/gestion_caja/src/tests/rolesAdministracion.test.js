// TDSI-68/992: roles Encargado de Devoluciones y Usuario de Soporte en el login de
// administracion y en la pantalla "Usuarios". Supabase Auth y facturacion (lista de
// supervisores) se reemplazan por un servidor falso con las mismas rutas, asi la prueba
// no crea cuentas reales; las filas de caja.* van a la BD y se limpian al final.
// Las URLs/llaves se fijan ANTES de cargar los modulos (las leen al cargarse).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");

const PREFIJO = `tdsi992-${Date.now()}`;
const correo = (n) => `${PREFIJO}-${n}@test.com`;

// ---------- Supabase Auth + facturacion falsos ----------
const cuentas = new Map(); // id -> { id, email, password }
const tokens = new Map(); // token -> id
const falso = express();
falso.use(express.json());
falso.post("/auth/v1/admin/users", (req, res) => {
  const { email, password } = req.body;
  if ([...cuentas.values()].some((c) => c.email === email)) {
    return res.status(422).json({ msg: "A user with this email address has already been registered" });
  }
  const cuenta = { id: crypto.randomUUID(), email, password };
  cuentas.set(cuenta.id, cuenta);
  res.json({ id: cuenta.id, email });
});
falso.put("/auth/v1/admin/users/:id", (req, res) => {
  const cuenta = cuentas.get(req.params.id);
  if (!cuenta) return res.status(404).json({ msg: "User not found" });
  Object.assign(cuenta, req.body);
  res.json({ id: cuenta.id, email: cuenta.email });
});
falso.post("/auth/v1/token", (req, res) => {
  const cuenta = [...cuentas.values()].find((c) => c.email === req.body.email && c.password === req.body.password);
  if (!cuenta) return res.status(400).json({ error_description: "Invalid login credentials" });
  const token = crypto.randomUUID();
  tokens.set(token, cuenta.id);
  res.json({ access_token: token, user: { id: cuenta.id, email: cuenta.email } });
});
falso.get("/auth/v1/user", (req, res) => {
  const id = tokens.get((req.headers.authorization || "").replace("Bearer ", ""));
  if (!id) return res.status(401).json({ msg: "invalid JWT" });
  res.json({ id, email: cuentas.get(id).email });
});
falso.get("/api/supervisores", (req, res) => res.json({ ok: true, data: [] }));

let servidorFalso, servidor, base;
let query;
let adminId;

const pedir = async (ruta, { metodo = "GET", cuerpo, token } = {}) => {
  const r = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { status: r.status, cuerpo: await r.json() };
};
const login = (email, password, rol) =>
  pedir("/api/auth/login-administrador", { metodo: "POST", cuerpo: { email, password, rol } });

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  const url = `http://localhost:${servidorFalso.address().port}`;
  Object.assign(process.env, {
    SUPABASE_URL: url, SUPABASE_ANON_KEY: "anon-falsa", SUPABASE_SERVICE_ROLE_KEY: "service-falsa", FACTURACION_URL: url,
  });

  ({ query } = require("../config/db"));
  const { requireAdministrador } = require("../middlewares/requireAdministrador");
  const { errorHandler } = require("../middlewares/errorHandler");
  const app = express();
  app.use(express.json());
  app.use("/api/auth", require("../routes/authRoutes"));
  app.use("/api/usuarios", requireAdministrador, require("../routes/usuariosRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}`;

  // El Administrador que ya existia (fila sin rol explicito => ADMINISTRADOR por el DEFAULT)
  const admin = { id: crypto.randomUUID(), email: correo("admin"), password: "admin123" };
  cuentas.set(admin.id, admin);
  adminId = admin.id;
  await query("INSERT INTO caja.administradores (cajero_id, nombre) VALUES ($1, 'Admin de prueba')", [admin.id]);
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  await query("DELETE FROM caja.administradores WHERE cajero_id = ANY($1)", [[...cuentas.keys()]]);
  await query("DELETE FROM caja.cajeros WHERE usuario LIKE $1", [`${PREFIJO}%`]);
  await require("../config/db").pool.end();
});

async function tokenAdmin() {
  const { cuerpo } = await login(correo("admin"), "admin123");
  return cuerpo.data.administrador.access_token;
}

test("TDSI-992: el Administrador de siempre entra igual (sin rol o con rol Administrador)", async () => {
  for (const rol of [undefined, "ADMINISTRADOR", "Administrador"]) {
    const { status, cuerpo } = await login(correo("admin"), "admin123", rol);
    assert.equal(status, 200, String(rol));
    assert.equal(cuerpo.data.administrador.rol, "ADMINISTRADOR");
    assert.equal(cuerpo.data.administrador.rol_nombre, "Administrador");
    assert.equal(cuerpo.data.administrador.administrador_id, adminId);
  }
});

test("TDSI-992: GET /api/usuarios/roles da los dos roles nuevos para \"Nuevo usuario\"", async () => {
  const { status, cuerpo } = await pedir("/api/usuarios/roles", { token: await tokenAdmin() });
  assert.equal(status, 200);
  assert.deepEqual(cuerpo.data, [
    { codigo: "ENCARGADO_DEVOLUCIONES", nombre: "Encargado de Devoluciones" },
    { codigo: "USUARIO_SOPORTE", nombre: "Usuario de Soporte" },
  ]);
});

test("TDSI-992: el Administrador registra un Encargado de Devoluciones y un Usuario de Soporte", async () => {
  const token = await tokenAdmin();
  const enc = await pedir("/api/usuarios/personal", {
    metodo: "POST", token, cuerpo: { usuario: correo("enc").toUpperCase(), password: "clave123", nombre: " Ana Encargada ", rol: "ENCARGADO_DEVOLUCIONES" },
  });
  assert.equal(enc.status, 201);
  assert.equal(enc.cuerpo.data.usuario, correo("enc"));
  assert.equal(enc.cuerpo.data.nombre, "Ana Encargada");
  assert.equal(enc.cuerpo.data.rol, "Encargado de Devoluciones");
  assert.equal(enc.cuerpo.data.rol_codigo, "ENCARGADO_DEVOLUCIONES");
  assert.equal(enc.cuerpo.data.estado, "Activo");

  // el rol tambien se acepta por su nombre, como sale en el selector
  const sop = await pedir("/api/usuarios/personal", {
    metodo: "POST", token, cuerpo: { usuario: correo("sop"), password: "clave123", nombre: "Sergio Soporte", rol: "Usuario de Soporte" },
  });
  assert.equal(sop.status, 201);
  assert.equal(sop.cuerpo.data.rol_codigo, "USUARIO_SOPORTE");

  const lista = await pedir("/api/usuarios", { token });
  assert.equal(lista.status, 200);
  const mios = lista.cuerpo.data.filter((u) => u.usuario && u.usuario.startsWith(PREFIJO));
  assert.deepEqual(mios.map((u) => [u.usuario, u.rol]).sort(), [
    [correo("enc"), "Encargado de Devoluciones"],
    [correo("sop"), "Usuario de Soporte"],
  ]);
  // el Administrador no aparece como una cuenta editable de la pantalla
  assert.ok(!lista.cuerpo.data.some((u) => u.id === adminId));
});

test("TDSI-992: valida el alta (rol, correo, contrasena, nombre y usuario repetido)", async () => {
  const token = await tokenAdmin();
  const alta = (cuerpo) => pedir("/api/usuarios/personal", { metodo: "POST", token, cuerpo });
  const base = { usuario: correo("val"), password: "clave123", nombre: "Val", rol: "USUARIO_SOPORTE" };

  for (const rol of [undefined, "Cajero", "ADMINISTRADOR", "Supervisor"]) {
    const r = await alta({ ...base, rol });
    assert.equal(r.status, 400, String(rol));
    assert.match(r.cuerpo.mensaje, /Encargado de Devoluciones o Usuario de Soporte/);
  }
  assert.equal((await alta({ ...base, usuario: "no-es-correo" })).status, 400);
  assert.equal((await alta({ ...base, password: "123" })).status, 400);
  assert.equal((await alta({ ...base, nombre: "  " })).status, 400);

  // repetido contra otra cuenta de administracion y contra un cajero
  const repetido = await alta({ ...base, usuario: correo("enc") });
  assert.equal(repetido.status, 409);
  assert.equal(repetido.cuerpo.mensaje, "Ese usuario ya esta registrado.");
  const cajero = await pedir("/api/usuarios/cajeros", { metodo: "POST", token, cuerpo: { usuario: correo("caj"), password: "clave123", nombre: "Caja" } });
  assert.equal(cajero.status, 201);
  assert.equal((await alta({ ...base, usuario: correo("caj") })).status, 409);
  assert.equal((await pedir("/api/usuarios/cajeros", { metodo: "POST", token, cuerpo: { usuario: correo("sop"), password: "clave123", nombre: "X" } })).status, 409);
});

test("TDSI-992: cada uno entra solo con la pestana de su perfil", async () => {
  const enc = await login(correo("enc"), "clave123", "ENCARGADO_DEVOLUCIONES");
  assert.equal(enc.status, 200);
  assert.equal(enc.cuerpo.data.administrador.rol, "ENCARGADO_DEVOLUCIONES");
  assert.equal(enc.cuerpo.data.administrador.rol_nombre, "Encargado de Devoluciones");
  assert.equal(enc.cuerpo.data.administrador.nombre, "Ana Encargada");
  assert.ok(enc.cuerpo.data.administrador.access_token);

  const sop = await login(correo("sop"), "clave123", "Usuario de Soporte");
  assert.equal(sop.status, 200);
  assert.equal(sop.cuerpo.data.administrador.rol, "USUARIO_SOPORTE");

  // pestana equivocada
  const comoAdmin = await login(correo("enc"), "clave123");
  assert.equal(comoAdmin.status, 403);
  assert.equal(comoAdmin.cuerpo.mensaje, "Este usuario no tiene permisos de administrador.");
  const comoSoporte = await login(correo("enc"), "clave123", "USUARIO_SOPORTE");
  assert.equal(comoSoporte.status, 403);
  assert.equal(comoSoporte.cuerpo.mensaje, "Este usuario no tiene el perfil Usuario de Soporte.");
  const adminComoEnc = await login(correo("admin"), "admin123", "ENCARGADO_DEVOLUCIONES");
  assert.equal(adminComoEnc.status, 403);
  assert.equal(adminComoEnc.cuerpo.mensaje, "Este usuario no tiene el perfil Encargado de Devoluciones.");
  // un cajero no entra por aqui con ningun perfil
  assert.equal((await login(correo("caj"), "clave123", "USUARIO_SOPORTE")).status, 403);

  assert.equal((await login(correo("enc"), "clave123", "Gerente")).status, 400);
  assert.equal((await login(correo("enc"), "mala", "ENCARGADO_DEVOLUCIONES")).status, 401);
});

test("TDSI-992: un Encargado o un Usuario de Soporte no gestiona usuarios (solo el Administrador)", async () => {
  for (const [n, rol] of [["enc", "ENCARGADO_DEVOLUCIONES"], ["sop", "USUARIO_SOPORTE"]]) {
    const { cuerpo } = await login(correo(n), "clave123", rol);
    const r = await pedir("/api/usuarios", { token: cuerpo.data.administrador.access_token });
    assert.equal(r.status, 403, rol);
    assert.equal(r.cuerpo.mensaje, "Esta accion requiere permisos de Administrador.");
  }
});

test("TDSI-992: Editar, Cambiar contrasena y Desactivar funcionan con los roles nuevos", async () => {
  const token = await tokenAdmin();
  const { cuerpo: lista } = await pedir("/api/usuarios", { token });
  const sop = lista.data.find((u) => u.usuario === correo("sop"));

  const editado = await pedir(`/api/usuarios/${sop.id}`, { metodo: "PUT", token, cuerpo: { usuario: correo("sop2"), nombre: "Sergio S." } });
  assert.equal(editado.status, 200);
  assert.equal(editado.cuerpo.data.usuario, correo("sop2"));
  assert.equal(editado.cuerpo.data.rol, "Usuario de Soporte");
  assert.equal(cuentas.get(sop.id).email, correo("sop2")); // tambien cambia el login
  assert.equal((await pedir(`/api/usuarios/${sop.id}`, { metodo: "PUT", token, cuerpo: { usuario: correo("enc"), nombre: "X" } })).status, 409);

  for (const ruta of [`/api/usuarios/${sop.id}/password`, `/api/usuarios/cajeros/${sop.id}/password`]) {
    const r = await pedir(ruta, { metodo: "PUT", token, cuerpo: { password: "nueva123" } });
    assert.equal(r.status, 200, ruta);
    assert.equal(r.cuerpo.data.rol, "Usuario de Soporte");
  }
  assert.equal((await pedir(`/api/usuarios/${sop.id}/password`, { metodo: "PUT", token, cuerpo: { password: "1" } })).status, 400);
  assert.equal((await pedir(`/api/usuarios/${adminId}/password`, { metodo: "PUT", token, cuerpo: { password: "nueva123" } })).status, 404);
  assert.equal((await login(correo("sop2"), "nueva123", "USUARIO_SOPORTE")).status, 200);

  const desactivado = await pedir(`/api/usuarios/${sop.id}/estado`, { metodo: "PATCH", token, cuerpo: { activo: false } });
  assert.equal(desactivado.status, 200);
  assert.equal(desactivado.cuerpo.data.estado, "Inactivo");
  const bloqueado = await login(correo("sop2"), "nueva123", "USUARIO_SOPORTE");
  assert.equal(bloqueado.status, 403);
  assert.equal(bloqueado.cuerpo.mensaje, "Esta cuenta esta desactivada. Contacte al Administrador.");

  const activado = await pedir(`/api/usuarios/${sop.id}/estado`, { metodo: "PATCH", token, cuerpo: { activo: true } });
  assert.equal(activado.cuerpo.data.estado, "Activo");
  assert.equal((await login(correo("sop2"), "nueva123", "USUARIO_SOPORTE")).status, 200);
});

test("TDSI-992: la BD rechaza un rol que no existe", async () => {
  await assert.rejects(
    () => query("INSERT INTO caja.administradores (cajero_id, nombre, rol) VALUES ($1, 'x', 'CAJERO')", [crypto.randomUUID()]),
    /administradores_rol_check/
  );
});
