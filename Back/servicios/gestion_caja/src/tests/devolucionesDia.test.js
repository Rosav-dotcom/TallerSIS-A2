// TDSI-80/1069: GET /api/caja/devoluciones -- devoluciones del dia agrupadas por caja (PA TDSI-1071),
// leyendo Devoluciones por HTTP. Devoluciones se reemplaza por un servidor falso; los nombres de
// las cajas salen de caja.cajas (BD real; se crean y borran cajas de prueba).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const SUF = String(Date.now()).slice(-5);
const CAJA_A = `TA${SUF}`;
const CAJA_B = `TB${SUF}`;
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());

const DEVOLUCIONES = [
  { codigo: "DEV-000010", caja_id: CAJA_B, monto_total: 600, opcion_reembolso: { codigo: "VALE", nombre: "Vale" }, autorizado_por: "SUP-01", autorizado_por_nombre: "Carlos Mamani", estado: "PENDIENTE", fecha: "x" },
  { codigo: "DEV-000011", caja_id: CAJA_A, monto_total: 20.1, opcion_reembolso: { codigo: "EFECTIVO", nombre: "Efectivo" }, autorizado_por: null, autorizado_por_nombre: null, estado: "PENDIENTE", fecha: "x" },
  { codigo: "DEV-000012", caja_id: CAJA_A, monto_total: 10.2, opcion_reembolso: { codigo: "EFECTIVO", nombre: "Efectivo" }, autorizado_por: null, autorizado_por_nombre: null, estado: "PROCESADA", fecha: "x" },
  { codigo: "DEV-000013", caja_id: null, monto_total: 5, opcion_reembolso: { codigo: "VALE", nombre: "Vale" }, autorizado_por: null, autorizado_por_nombre: null, estado: "APROBADA", fecha: "x" },
  { codigo: "DEV-000014", caja_id: CAJA_A, monto_total: 30, opcion_reembolso: { codigo: "VALE", nombre: "Vale" }, autorizado_por: null, autorizado_por_nombre: null, estado: "PENDIENTE", fecha: "x" },
  { codigo: "DEV-000015", caja_id: "CAJA-DESCONOCIDA", monto_total: 1, opcion_reembolso: null, autorizado_por: null, autorizado_por_nombre: null, estado: "PENDIENTE", fecha: "x" },
];

const pedidos = [];
let caida = false;
const falso = express();
falso.get("/api/devoluciones/del-dia", (req, res) => {
  pedidos.push(req.query.fecha);
  if (caida) return res.status(500).json({ ok: false });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)) return res.status(400).json({ ok: false, mensaje: "'fecha' debe ser una fecha con formato AAAA-MM-DD." });
  res.json({ ok: true, data: { fecha: req.query.fecha, devoluciones: req.query.fecha === hoy ? DEVOLUCIONES : [] } });
});

let servidorFalso, servidor, base, query, pool;
const pedir = async (q = "") => {
  const r = await fetch(`${base}${q}`);
  return { status: r.status, cuerpo: await r.json() };
};

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.DEVOLUCIONES_URL = `http://localhost:${servidorFalso.address().port}`;
  ({ query, pool } = require("../config/db"));
  await query("INSERT INTO caja.cajas (codigo, nombre) VALUES ($1, 'Caja Principal'), ($2, 'Caja Express')", [CAJA_A, CAJA_B]);
  const app = express();
  app.use("/api/caja/devoluciones", require("../routes/devolucionesCajaRoutes"));
  app.use(require("../middlewares/errorHandler").errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/caja/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  await query("DELETE FROM caja.cajas WHERE codigo = ANY($1)", [[CAJA_A, CAJA_B]]);
  await pool.end();
});

test("TDSI-1071: las devoluciones del dia salen agrupadas por caja, con su total", async () => {
  const { status, cuerpo } = await pedir();
  assert.equal(status, 200);
  const d = cuerpo.data;
  assert.equal(d.fecha, hoy); // sin fecha: hoy (hora de Bolivia)
  assert.equal(pedidos.at(-1), hoy);
  assert.equal(d.total_devoluciones, 6);
  assert.equal(d.monto_total, 666.3);

  // ordenadas por codigo de caja y "Sin caja" al final
  assert.deepEqual(d.cajas.map((c) => [c.caja_id, c.caja_nombre, c.cantidad, c.monto_total]), [
    ["CAJA-DESCONOCIDA", "CAJA-DESCONOCIDA", 1, 1],
    [CAJA_A, "Caja Principal", 3, 60.3],
    [CAJA_B, "Caja Express", 1, 600],
    [null, "Sin caja", 1, 5],
  ]);
  const a = d.cajas.find((c) => c.caja_id === CAJA_A);
  assert.deepEqual(a.por_metodo, [{ metodo: "Efectivo", monto: 30.3 }, { metodo: "Vale", monto: 30 }]);
  assert.deepEqual(a.devoluciones.map((x) => x.codigo), ["DEV-000011", "DEV-000012", "DEV-000014"]);
});

test("TDSI-1086: cada devolucion trae su metodo y que supervisor la autorizo", async () => {
  const b = (await pedir()).cuerpo.data.cajas.find((c) => c.caja_id === CAJA_B);
  assert.deepEqual(b.devoluciones[0], {
    codigo: "DEV-000010", fecha: "x", estado: "PENDIENTE", monto: 600, metodo: "Vale",
    autorizado_por: { supervisor_id: "SUP-01", nombre: "Carlos Mamani" },
  });
  const sinMetodo = (await pedir()).cuerpo.data.cajas[0].devoluciones[0];
  assert.deepEqual([sinMetodo.metodo, sinMetodo.autorizado_por], ["Sin definir", null]);
});

test("TDSI-1069: otro dia, dia sin devoluciones, fecha invalida y Devoluciones caida", async () => {
  const vacio = await pedir("?fecha=2026-01-02");
  assert.equal(vacio.status, 200);
  assert.deepEqual(vacio.cuerpo.data, { fecha: "2026-01-02", total_devoluciones: 0, monto_total: 0, cajas: [] });

  for (const f of ["2026-13-01", "ayer"]) assert.equal((await pedir(`?fecha=${f}`)).status, 400, f);

  caida = true;
  try {
    const r = await pedir();
    assert.equal(r.status, 502);
    assert.match(r.cuerpo.mensaje, /Devoluciones/);
  } finally {
    caida = false;
  }
});
