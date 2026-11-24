// TDSI-71: motivos de devolucion -- el catalogo (TDSI-219) y el endpoint (TDSI-1102).
// Usa la BD real (sql/script_devoluciones.sql aplicado) y deja los motivos como estaban.
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { query, pool } = require("../config/db");

const LOS_4 = ["Producto vencido", "Empaque dañado", "Error de cobro", "Cambio de producto"];
let servidor;
let base;

test.before(async () => {
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await pool.end();
});

const pedir = async (ruta) => {
  const r = await fetch(`${base}${ruta}`);
  return { status: r.status, cuerpo: await r.json() };
};

test("TDSI-1011: el selector recibe solo los 4 motivos, en orden", async () => {
  const { status, cuerpo } = await pedir("/motivos");
  assert.equal(status, 200);
  assert.deepEqual(cuerpo.data.map((m) => m.nombre), LOS_4);
  for (const m of cuerpo.data) assert.equal(typeof m.id, "number");
});

test("TDSI-219: los motivos de ejemplo de la primera version quedan desactivados (no borrados)", async () => {
  const { rows } = await query(
    `SELECT nombre, activo FROM devoluciones.motivos
      WHERE nombre IN ('Producto defectuoso', 'Producto equivocado', 'Cliente se arrepintio', 'Otro')`
  );
  for (const r of rows) assert.equal(r.activo, false, r.nombre);
});

test("TDSI-1102: un motivo desactivado deja de salir en la lista", async () => {
  await query("UPDATE devoluciones.motivos SET activo = false WHERE nombre = 'Error de cobro'");
  try {
    const { cuerpo } = await pedir("/motivos");
    assert.deepEqual(cuerpo.data.map((m) => m.nombre), ["Producto vencido", "Empaque dañado", "Cambio de producto"]);
  } finally {
    await query("UPDATE devoluciones.motivos SET activo = true WHERE nombre = 'Error de cobro'");
  }
});

test("TDSI-1102: /motivos no se confunde con el detalle /:codigo", async () => {
  assert.equal((await pedir("/motivos")).status, 200);
  assert.equal((await pedir("/DEV-9999999999")).status, 404);
});
