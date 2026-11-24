// TDSI-1110 (TDSI-75): tests de vales de compra -- código único, saldo y expirado.
// Usan la base de datos (igual que los demás tests de gestion_pagos) y borran lo que crean.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const { pool, query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { generarVale, consultarVale, listarVales, generarCodigo, FORMATO_CODIGO } = require("../services/valesService");
const sistemasRepo = require("../data/sistemasClienteRepo");
const { hashSecret } = require("../utils/secretHash");
const { generarToken } = require("../services/authService");

const SUFIJO = Date.now().toString(36);
const EMISOR = `test-vales-${SUFIJO}@tallersis.bo`;
const CLIENTE = `test-vales-${SUFIJO}`;
const HOY_BOLIVIA = `(now() AT TIME ZONE 'America/La_Paz')::date`;

const hoyEnBolivia = async () => (await query(`SELECT to_char(${HOY_BOLIVIA}, 'YYYY-MM-DD') AS hoy`)).rows[0].hoy;
const masDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/** Vale creado directo en la tabla, con su último día a "dias" de hoy (negativo = ya venció). */
async function valeQueVence(dias, { estado = "Activo", saldo = 25 } = {}) {
  const codigo = generarCodigo();
  await query(
    `INSERT INTO pagos.vales_compra (codigo, monto, saldo, estado, expira_en, emitido_en, emitido_por)
     VALUES ($1, 25, $2, $3, ${HOY_BOLIVIA} + $4::int, now() - interval '60 days', $5)`,
    [codigo, saldo, estado, dias, EMISOR]
  );
  return codigo;
}

test.after(async () => {
  await query(`DELETE FROM pagos.vales_compra WHERE emitido_por = $1`, [EMISOR]);
  await query(`DELETE FROM pagos.sistemas_cliente WHERE client_id = $1`, [CLIENTE]);
  await pool.end();
});

// ---------------------------------------------------------------------------
// Código único
// ---------------------------------------------------------------------------

test("código: formato VAL-XXXX-XXXX sin I, L, O, 0 ni 1, y no se repite en 5000", () => {
  const codigos = new Set();
  for (let i = 0; i < 5000; i += 1) {
    const c = generarCodigo();
    assert.match(c, FORMATO_CODIGO);
    assert.doesNotMatch(c.slice(4), /[ILO01]/);
    codigos.add(c);
  }
  assert.equal(codigos.size, 5000);
});

test("código único: si el código ya existe se genera otro y el vale se guarda igual", async () => {
  const primero = await generarVale({ monto: 10, emitido_por: EMISOR });
  const intentos = [primero.codigo, primero.codigo, generarCodigo()];
  let i = 0;
  const segundo = await generarVale({ monto: 12, emitido_por: EMISOR }, { generar: () => intentos[i++] });
  assert.equal(i, 3); // dos choques y el tercero entra
  assert.notEqual(segundo.codigo, primero.codigo);
  assert.equal(segundo.codigo, intentos[2]);
});

test("código único: si choca 5 veces seguidas, no inventa un vale y avisa el error", async () => {
  const existente = await generarVale({ monto: 10, emitido_por: EMISOR });
  await assert.rejects(generarVale({ monto: 10, emitido_por: EMISOR }, { generar: () => existente.codigo }), (e) => e.code === "23505");
  const { rows } = await query(`SELECT count(*)::int AS n FROM pagos.vales_compra WHERE codigo = $1`, [existente.codigo]);
  assert.equal(rows[0].n, 1);
});

// ---------------------------------------------------------------------------
// Generar y saldo (PA TDSI-1033 y TDSI-1034)
// ---------------------------------------------------------------------------

test("generar: código, monto, saldo = monto, Activo y vence en los días pedidos (día de Bolivia)", async () => {
  const hoy = await hoyEnBolivia();
  const v = await generarVale({ monto: "150.50", emitido_por: EMISOR, devolucion_id: "DEV-TEST", dias_validez: 30 });
  assert.match(v.codigo, FORMATO_CODIGO);
  assert.equal(v.monto, 150.5);
  assert.equal(v.saldo, 150.5);
  assert.equal(v.estado, "Activo");
  assert.equal(v.expira_en, masDias(hoy, 30));
  assert.equal(v.dias_restantes, 30);
  assert.equal(v.devolucion_id, "DEV-TEST");
});

test("generar: sin días de validez usa VALE_DIAS_VALIDEZ (90 por defecto)", async () => {
  const v = await generarVale({ monto: 5, emitido_por: EMISOR });
  assert.equal(v.dias_restantes, Number(process.env.VALE_DIAS_VALIDEZ || 90));
});

test("generar: validaciones (400) y montos con centavos que sí son válidos", async () => {
  const casos = [
    { monto: 0, emitido_por: EMISOR },
    { monto: -5, emitido_por: EMISOR },
    { monto: "abc", emitido_por: EMISOR },
    { monto: 10.555, emitido_por: EMISOR },
    { monto: 100001, emitido_por: EMISOR },
    { monto: 10 },
    { monto: 10, emitido_por: EMISOR, dias_validez: 0 },
    { monto: 10, emitido_por: EMISOR, dias_validez: 366 },
    { monto: 10, emitido_por: EMISOR, dias_validez: 1.5 },
  ];
  for (const datos of casos) {
    await assert.rejects(generarVale(datos), (e) => e.status === 400, JSON.stringify(datos));
  }
  for (const monto of [0.29, 0.55, 19.99, 10.1]) {
    assert.equal((await generarVale({ monto, emitido_por: EMISOR })).saldo, monto);
  }
});

test("consultar: por código se ve el saldo y el estado (también en minúsculas)", async () => {
  const v = await generarVale({ monto: 80, emitido_por: EMISOR });
  const consultado = await consultarVale(v.codigo.toLowerCase());
  assert.equal(consultado.codigo, v.codigo);
  assert.equal(consultado.saldo, 80);
  assert.equal(consultado.estado, "Activo");
});

test("consultar: código inexistente 404 y con formato inválido 400", async () => {
  await assert.rejects(consultarVale("VAL-ZZZZ-9999"), (e) => e.status === 404 && /VAL-ZZZZ-9999/.test(e.message));
  for (const malo of ["", "VAL-1234", "VAL-OOOO-0000", "ABC-ABCD-ABCD", "VAL-ABCD-ABCD; DROP"]) {
    await assert.rejects(consultarVale(malo), (e) => e.status === 400, malo);
  }
});

// ---------------------------------------------------------------------------
// Expirado (TDSI-1109)
// ---------------------------------------------------------------------------

test("expirado: un vale Activo que venció ayer se consulta como Expirado y queda así guardado", async () => {
  const codigo = await valeQueVence(-1);
  const v = await consultarVale(codigo);
  assert.equal(v.estado, "Expirado");
  assert.equal(v.dias_restantes, -1);
  const { rows } = await query(`SELECT estado FROM pagos.vales_compra WHERE codigo = $1`, [codigo]);
  assert.equal(rows[0].estado, "Expirado");
});

test("expirado: el último día todavía es válido", async () => {
  const v = await consultarVale(await valeQueVence(0));
  assert.equal(v.estado, "Activo");
  assert.equal(v.dias_restantes, 0);
});

test("expirado: un vale Usado vencido sigue Usado", async () => {
  const v = await consultarVale(await valeQueVence(-10, { estado: "Usado", saldo: 0 }));
  assert.equal(v.estado, "Usado");
});

test("expirado: la lista tampoco muestra como Activo un vale vencido", async () => {
  const vencido = await valeQueVence(-3);
  const activos = await listarVales({ estado: "Activo" });
  assert.ok(!activos.some((v) => v.codigo === vencido));
  const expirados = await listarVales({ estado: "Expirado", codigo: vencido.slice(4, 8) });
  assert.ok(expirados.some((v) => v.codigo === vencido));
});

test("listar: filtros por devolución y estado inválido (400)", async () => {
  const devolucion = `DEV-${SUFIJO}`;
  await generarVale({ monto: 7, emitido_por: EMISOR, devolucion_id: devolucion });
  assert.equal((await listarVales({ devolucion_id: devolucion })).length, 1);
  await assert.rejects(listarVales({ estado: "Borrado" }), (e) => e.status === 400);
});

// ---------------------------------------------------------------------------
// Rutas HTTP
// ---------------------------------------------------------------------------

test("rutas: generar pide el token de Devoluciones; consultar no", async () => {
  const secreto = crypto.randomBytes(16).toString("hex");
  await sistemasRepo.crear({ client_id: CLIENTE, nombre: "Devoluciones (test)", secret_hash: hashSecret(secreto) });
  const { access_token } = await generarToken({ client_id: CLIENTE, client_secret: secreto });

  const app = express();
  app.use(express.json());
  app.use("/api/pagos/vales", require("../routes/valesRoutes"));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const url = `http://localhost:${servidor.address().port}/api/pagos/vales`;
  const generar = (token) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ monto: 45, emitido_por: EMISOR }),
    });

  try {
    assert.equal((await generar(null)).status, 401);
    const r = await generar(access_token);
    assert.equal(r.status, 201);
    const { data } = await r.json();
    assert.equal(data.saldo, 45);

    const consulta = await fetch(`${url}/${data.codigo}`);
    assert.equal(consulta.status, 200);
    assert.equal((await consulta.json()).data.saldo, 45);
    assert.equal((await fetch(`${url}/VAL-ZZZZ-9999`)).status, 404);
  } finally {
    servidor.close();
  }
});
