// TDSI-80/1069 (lado Devoluciones): GET /api/devoluciones/del-dia -- las devoluciones de un dia
// de Bolivia, sin las rechazadas, con su caja, monto, metodo y supervisor, para el resumen por
// caja de gestion_caja. BD real; borra lo que crea y devuelve el correlativo DEV- a su valor.
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { query, pool } = require("../config/db");
const devolucionesRepo = require("../data/devolucionesRepo");
const { validarPedido } = require("../services/registroService");

const FACTURA = `T1069-${String(Date.now()).slice(-8)}`;
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
const creados = [];
let servidor, base, correlativoInicial;

async function crear({ caja_id = null, monto = 10, opcion = "EFECTIVO", autorizado = null } = {}) {
  const d = await devolucionesRepo.crear({
    factura_numero: FACTURA, fecha_venta: new Date(), dentro_de_plazo: true, tipo: "PARCIAL",
    metodo_pago_original: "Efectivo", monto_total: monto, opcion_reembolso: opcion, creado_por: "ana@test.com", caja_id,
    ...(autorizado ? { autorizado_por: autorizado[0], autorizado_por_nombre: autorizado[1], autorizado_en: new Date(), requiere_autorizacion: true } : {}),
  }, []);
  creados.push(Number(d.codigo.slice(4)));
  return d;
}
const delDia = async (q = "") => {
  const r = await fetch(`${base}/del-dia${q}`);
  return { status: r.status, cuerpo: await r.json() };
};
const mias = (data) => data.devoluciones.filter((d) => creados.includes(Number(d.codigo.slice(4))));

test.before(async () => {
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero = $1", [FACTURA]);
  if (creados.length) {
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2",
      [correlativoInicial, Math.max(...creados)]);
  }
  await pool.end();
});

test("TDSI-1069: trae las devoluciones de hoy con caja, monto, metodo y supervisor (sin las rechazadas)", async () => {
  const a = await crear({ caja_id: "CAJA-T1", monto: 20 });
  const b = await crear({ caja_id: "CAJA-T1", monto: 600, opcion: "VALE", autorizado: ["SUP-01", "Carlos Mamani"] });
  const sinCaja = await crear({ monto: 5 });
  const rechazada = await crear({ caja_id: "CAJA-T1", monto: 99 });
  await devolucionesRepo.cambiarEstado(rechazada.codigo, "RECHAZADA", { usuario: "ana", extra: { motivo_rechazo: "No procede" } });
  const ayer = await crear({ caja_id: "CAJA-T1", monto: 7 });
  await query("UPDATE devoluciones.devoluciones SET fecha_solicitud = fecha_solicitud - interval '1 day' WHERE id = $1", [ayer.id]);

  const { status, cuerpo } = await delDia();
  assert.equal(status, 200);
  assert.equal(cuerpo.data.fecha, hoy);
  const lista = mias(cuerpo.data);
  assert.deepEqual(lista.map((d) => d.codigo).sort(), [a.codigo, b.codigo, sinCaja.codigo].sort());
  const autorizada = lista.find((d) => d.codigo === b.codigo);
  assert.deepEqual(
    [autorizada.caja_id, autorizada.monto_total, autorizada.opcion_reembolso, autorizada.autorizado_por, autorizada.autorizado_por_nombre],
    ["CAJA-T1", 600, { codigo: "VALE", nombre: "Vale" }, "SUP-01", "Carlos Mamani"]
  );
  assert.equal(lista.find((d) => d.codigo === sinCaja.codigo).caja_id, null);

  // el dia de ayer trae la de ayer
  const diaAyer = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date(Date.now() - 864e5));
  assert.deepEqual(mias((await delDia(`?fecha=${diaAyer}`)).cuerpo.data).map((d) => d.codigo), [ayer.codigo]);
});

test("TDSI-1069: fecha invalida -> 400; del-dia no se confunde con un codigo", async () => {
  for (const f of ["2026-13-01", "ayer", "24/11/2026"]) assert.equal((await delDia(`?fecha=${f}`)).status, 400, f);
  assert.equal((await fetch(`${base}/DEV-9999999999`)).status, 404);
});

test("TDSI-1069: el registro acepta la caja (opcional) y valida su codigo", () => {
  const base = { factura_numero: "F-1", items: [{ item_id: 1, cantidad: 1 }], motivo_id: 1, opcion_reembolso: "VALE", creado_por: "ana" };
  assert.equal(validarPedido(base).cajaId, null);
  assert.equal(validarPedido({ ...base, caja_id: " caja-01 " }).cajaId, "CAJA-01");
  for (const caja_id of ["CAJA 01", "x".repeat(21), 5, "caja;drop"]) {
    assert.throws(() => validarPedido({ ...base, caja_id }), { status: 400 }, String(caja_id));
  }
});
