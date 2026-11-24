// TDSI-80: devoluciones sobre el monto limite -- limite configurable (TDSI-237).
// Facturacion se reemplaza por un servidor falso; las devoluciones y la configuracion van a la
// BD real y se deja todo como estaba.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const SUF = String(Date.now()).slice(-8);
const N = (letra) => `T80-${SUF}-${letra}`;
let siguienteItem = 8000;
function factura(letra, precio) {
  return {
    numero: N(letra), fecha: new Date().toISOString(), estado: "Emitida", cliente_nit: "1234567", cliente_nombre: "Ana",
    canal: "Presencial", subtotal: String(precio), descuento: "0", impuesto: "0", total: String(precio),
    items: [{ id: String(siguienteItem++), descripcion: "Televisor", cantidad: "1", precio_unitario: String(precio), subtotal: String(precio) }],
    metodosPago: [{ metodo: "Efectivo", monto: String(precio) }],
  };
}
const FACTURAS = Object.fromEntries([
  factura("ALTA", 600), factura("JUSTO", 500), factura("BAJA", 120), factura("CONF", 600),
].map((f) => [f.numero, f]));

const falso = express();
falso.use(express.json());
falso.get("/api/facturas/:numero", (req, res) => {
  const f = FACTURAS[req.params.numero];
  return f ? res.json({ ok: true, data: f }) : res.status(404).json({ ok: false });
});

let servidorFalso, servidor, base, query, pool, correlativoInicial, motivoId, limiteOriginal;
const creados = [];

async function registrar(letra, extra = {}) {
  const f = FACTURAS[N(letra)];
  const r = await fetch(base, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factura_numero: f.numero, items: [{ item_id: Number(f.items[0].id), cantidad: 1 }], motivo_id: motivoId,
      opcion_reembolso: "EFECTIVO", creado_por: "ana@test.com", ...extra,
    }),
  });
  const cuerpo = await r.json();
  if (r.status === 201) creados.push(Number(cuerpo.data.codigo.slice(4)));
  return { status: r.status, cuerpo };
}
const ponerLimite = (valor) => query("UPDATE devoluciones.configuracion SET valor = $1 WHERE clave = 'limite_autorizacion'", [valor]);
const cuantas = async (letra) =>
  (await query("SELECT count(*)::int AS n FROM devoluciones.devoluciones WHERE factura_numero = $1", [N(letra)])).rows[0].n;

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.FACTURACION_URL = `http://localhost:${servidorFalso.address().port}`;
  ({ query, pool } = require("../config/db"));
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  motivoId = Number((await query("SELECT id FROM devoluciones.motivos WHERE nombre = 'Producto vencido'")).rows[0].id);
  limiteOriginal = (await query("SELECT valor FROM devoluciones.configuracion WHERE clave = 'limite_autorizacion'")).rows[0].valor;
  await ponerLimite("500");
  const app = require("../app");
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  await ponerLimite(limiteOriginal);
  await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero LIKE $1", [`T80-${SUF}-%`]);
  if (creados.length) {
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2",
      [correlativoInicial, Math.max(...creados)]);
  }
  await pool.end();
});

test("TDSI-237: el limite sale de la configuracion (por defecto 500)", async () => {
  const r = await (await fetch(`${base}/configuracion/limite-autorizacion`)).json();
  assert.equal(r.data.limite, 500);
  assert.equal(r.data.por_defecto, false);
  for (const malo of ["0", "-1", "abc", "1.234"]) {
    await assert.rejects(() => ponerLimite(malo), /configuracion_limite_valido/, malo);
  }
});

test("TDSI-237: sobre el limite no se registra sin autorizacion del supervisor", async () => {
  const r = await registrar("ALTA");
  assert.equal(r.status, 403);
  assert.equal(r.cuerpo.mensaje, "Requiere autorización del Supervisor");
  assert.deepEqual(r.cuerpo.detalle, { monto_total: 600, limite: 500 });
  assert.equal(await cuantas("ALTA"), 0);
});

test("TDSI-237: hasta el limite (inclusive) no hace falta autorizacion", async () => {
  const justo = await registrar("JUSTO");
  assert.equal(justo.status, 201);
  assert.equal(justo.cuerpo.data.monto_total, 500);
  assert.equal(justo.cuerpo.data.requiere_autorizacion, false);
  assert.equal((await registrar("BAJA")).cuerpo.data.requiere_autorizacion, false);
});

test("TDSI-237: cambiar el limite en la configuracion cambia la regla", async () => {
  await ponerLimite("1000");
  try {
    const r = await registrar("CONF");
    assert.equal(r.status, 201);
    assert.equal(r.cuerpo.data.requiere_autorizacion, false);
  } finally {
    await ponerLimite("500");
  }
});
