// TDSI-213: el microservicio arranca, responde y llega a PostgreSQL (usa DATABASE_URL).
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { pool } = require("../config/db");

let servidor;
let base;

test.before(async () => {
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await pool.end();
});

test("TDSI-213: GET /devoluciones responde que el microservicio esta activo", async () => {
  const r = await fetch(`${base}/devoluciones`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).estado, "activo");
});

test("TDSI-213: GET /health confirma la BD y el esquema devoluciones", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, db: "up", esquema: "devoluciones" });
});

test("TDSI-213: una ruta que no existe responde 404", async () => {
  const r = await fetch(`${base}/api/devoluciones/no-existe`);
  assert.equal(r.status, 404);
});
