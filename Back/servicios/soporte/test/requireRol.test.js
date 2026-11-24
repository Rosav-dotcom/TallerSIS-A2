// TDSI-665: middleware de rol de Soporte (gestion_caja simulado, sin red)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { crearRequireRol, ROLES_SOPORTE } = require("../src/middlewares/requireRol");
const { AppError } = require("../src/utils/AppError");

// Respuestas que daria gestion_caja (GET /api/auth/perfil) segun el token
const PERFILES = {
  "Bearer tok-soporte": { usuario_id: "u1", email: "soporte@tallersis.bo", nombre: "Ana Soporte", rol: "USUARIO_SOPORTE" },
  "Bearer tok-admin": { usuario_id: "u2", email: "admin@tallersis.bo", nombre: "Admin", rol: "ADMINISTRADOR" },
  "Bearer tok-encargado": { usuario_id: "u3", email: "dev@tallersis.bo", nombre: "Encargado", rol: "ENCARGADO_DEVOLUCIONES" },
};

function cajaFalsa() {
  const llamadas = [];
  return {
    llamadas,
    caida: false,
    async obtenerPerfil(authorization) {
      llamadas.push(authorization);
      if (this.caida) throw new AppError("No se pudo conectar con gestion_caja", 503);
      if (authorization === "Bearer tok-cajero") {
        const e = new AppError("gestion_caja respondió con error", 502, "Esta cuenta no tiene un perfil de administracion.");
        e.statusOrigen = 403;
        throw e;
      }
      if (!PERFILES[authorization]) {
        const e = new AppError("gestion_caja respondió con error", 502, "Token invalido o vencido");
        e.statusOrigen = 401;
        throw e;
      }
      return PERFILES[authorization];
    },
  };
}

async function levantar(caja, opciones = {}) {
  const requireRol = crearRequireRol({ cajaClient: caja, ...opciones });
  const app = express();
  app.use("/api/soporte", requireRol(...ROLES_SOPORTE), (req, res) => res.json({ ok: true, usuario: req.usuario }));
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const url = `http://127.0.0.1:${servidor.address().port}/api/soporte/algo`;
  const pedir = async (token) => {
    const r = await fetch(url, token ? { headers: { Authorization: token } } : {});
    return { status: r.status, cuerpo: await r.json() };
  };
  return { servidor, pedir };
}

test("sin token o con otro esquema: 401 sin consultar a gestion_caja", async () => {
  const caja = cajaFalsa();
  const { servidor, pedir } = await levantar(caja);
  try {
    assert.equal((await pedir(null)).status, 401);
    assert.equal((await pedir("Basic abc")).status, 401);
    assert.equal(caja.llamadas.length, 0);
  } finally { servidor.close(); }
});

test("Usuario de Soporte y Administrador pasan y quedan en req.usuario", async () => {
  const { servidor, pedir } = await levantar(cajaFalsa());
  try {
    const soporte = await pedir("Bearer tok-soporte");
    assert.equal(soporte.status, 200);
    assert.equal(soporte.cuerpo.usuario.rol, "USUARIO_SOPORTE");
    assert.equal(soporte.cuerpo.usuario.email, "soporte@tallersis.bo");
    assert.equal((await pedir("Bearer tok-admin")).status, 200);
  } finally { servidor.close(); }
});

test("Encargado de Devoluciones: 403", async () => {
  const { servidor, pedir } = await levantar(cajaFalsa());
  try {
    const r = await pedir("Bearer tok-encargado");
    assert.equal(r.status, 403);
    assert.match(r.cuerpo.mensaje, /Usuario de Soporte y el Administrador/);
  } finally { servidor.close(); }
});

test("cajero (sin perfil de administracion): 403 con el mensaje de gestion_caja", async () => {
  const { servidor, pedir } = await levantar(cajaFalsa());
  try {
    const r = await pedir("Bearer tok-cajero");
    assert.equal(r.status, 403);
    assert.match(r.cuerpo.mensaje, /perfil de administracion/);
  } finally { servidor.close(); }
});

test("token inválido o vencido: 401", async () => {
  const { servidor, pedir } = await levantar(cajaFalsa());
  try {
    const r = await pedir("Bearer tok-vencido");
    assert.equal(r.status, 401);
    assert.match(r.cuerpo.mensaje, /inválido o vencido/);
  } finally { servidor.close(); }
});

test("gestion_caja caído: 503", async () => {
  const caja = cajaFalsa();
  caja.caida = true;
  const { servidor, pedir } = await levantar(caja);
  try {
    assert.equal((await pedir("Bearer tok-soporte")).status, 503);
  } finally { servidor.close(); }
});

test("el perfil se guarda un momento: dos pedidos, una consulta; al vencer se vuelve a consultar", async () => {
  const caja = cajaFalsa();
  let reloj = 0;
  const { servidor, pedir } = await levantar(caja, { cacheMs: 1000, ahora: () => reloj });
  try {
    await pedir("Bearer tok-soporte");
    await pedir("Bearer tok-soporte");
    assert.equal(caja.llamadas.length, 1);
    reloj = 1500;
    await pedir("Bearer tok-soporte");
    assert.equal(caja.llamadas.length, 2);
  } finally { servidor.close(); }
});

test("un token rechazado no se guarda: se vuelve a consultar", async () => {
  const caja = cajaFalsa();
  const { servidor, pedir } = await levantar(caja);
  try {
    await pedir("Bearer tok-vencido");
    await pedir("Bearer tok-vencido");
    assert.equal(caja.llamadas.length, 2);
  } finally { servidor.close(); }
});
