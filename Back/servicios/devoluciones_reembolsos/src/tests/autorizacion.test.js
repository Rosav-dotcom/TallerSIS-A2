// TDSI-80: devoluciones sobre el monto limite -- limite configurable (TDSI-237) y autorizacion
// con usuario y PIN del supervisor (TDSI-1085; PA TDSI-1054, TDSI-1055 y TDSI-1056).
// Facturacion (facturas y POST /api/supervisores/validar) se reemplaza por un servidor falso;
// las devoluciones y la configuracion van a la BD real y se deja todo como estaba.
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
  factura("AUT", 750), factura("PIN", 600), factura("BLOQ", 600), factura("CAIDA", 600), factura("BAJA2", 100),
].map((f) => [f.numero, f]));

const falso = express();
falso.use(express.json());
// Como facturacion (TDSI-55): SUP-01 / 1234; un PIN mal escrito es 400, uno incorrecto 401 y
// SUP-BLOQ esta bloqueado (423). SUP-ROTO simula una falla de facturacion.
const validaciones = [];
falso.post("/api/supervisores/validar", (req, res) => {
  const { supervisor_id, pin } = req.body || {};
  validaciones.push(supervisor_id);
  if (supervisor_id === "SUP-ROTO") return res.status(500).json({ ok: false, mensaje: "Error interno" });
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) return res.status(400).json({ ok: false, mensaje: "El PIN debe tener entre 4 y 6 dígitos" });
  if (supervisor_id === "SUP-BLOQ") {
    return res.status(423).json({ ok: false, mensaje: "Supervisor bloqueado por intentos fallidos. Intente en 10 minuto(s)", detalle: { bloqueado_hasta: "x" } });
  }
  if (supervisor_id !== "SUP-01" || pin !== "1234") {
    return res.status(401).json({ ok: false, mensaje: "Supervisor o PIN incorrecto", detalle: { intentos_restantes: 2 } });
  }
  res.json({ ok: true, data: { supervisor_id: "SUP-01", nombre: "Carlos Mamani" } });
});
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

// ---------- TDSI-1085: usuario y PIN del supervisor ----------
const SUP_OK = { supervisor_id: "SUP-01", pin: "1234" };

test("TDSI-1056: con usuario y PIN validos se registra y el detalle muestra que supervisor autorizo", async () => {
  const r = await registrar("AUT", { autorizacion: SUP_OK });
  assert.equal(r.status, 201);
  const d = r.cuerpo.data;
  assert.equal(d.monto_total, 750);
  assert.equal(d.requiere_autorizacion, true);
  assert.equal(d.autorizado_por, "SUP-01");
  assert.deepEqual([d.autorizacion.supervisor_id, d.autorizacion.nombre], ["SUP-01", "Carlos Mamani"]);
  assert.ok(Math.abs(Date.parse(d.autorizacion.fecha) - Date.now()) < 60000);

  const guardada = await (await fetch(`${base}/${d.codigo}`)).json();
  assert.deepEqual(guardada.data, d);
  const historial = (await (await fetch(`${base}/${d.codigo}/historial`)).json()).data.historial;
  assert.equal(historial[0].comentario, "Devolución registrada · autorizada por el supervisor Carlos Mamani (SUP-01)");
  assert.equal(historial[0].usuario, "ana@test.com");
});

test("TDSI-1055: con PIN incorrecto se responde \"PIN inválido\" y no se registra", async () => {
  for (const autorizacion of [
    { supervisor_id: "SUP-01", pin: "9999" }, // PIN incorrecto
    { supervisor_id: "SUP-01", pin: "12" }, // mal escrito
    { supervisor_id: "SUP-01", pin: "" },
    { supervisor_id: "SUP-01" }, // sin PIN
    { supervisor_id: "NO-EXISTE", pin: "1234" }, // no dice si fallo el usuario o el PIN
  ]) {
    const r = await registrar("PIN", { autorizacion });
    assert.equal(r.status, 401, JSON.stringify(autorizacion));
    assert.equal(r.cuerpo.mensaje, "PIN inválido");
  }
  const conIntentos = await registrar("PIN", { autorizacion: { supervisor_id: "SUP-01", pin: "0000" } });
  assert.deepEqual(conIntentos.cuerpo.detalle, { intentos_restantes: 2 });
  assert.equal(await cuantas("PIN"), 0);
});

test("TDSI-1054: sobre el limite no se procesa sin usuario y PIN validos", async () => {
  assert.equal((await registrar("PIN")).status, 403); // sin autorizacion
  const sinUsuario = await registrar("PIN", { autorizacion: { pin: "1234" } });
  assert.equal(sinUsuario.status, 400);
  assert.equal(sinUsuario.cuerpo.mensaje, "Indique el usuario del supervisor que autoriza.");
  assert.equal((await registrar("PIN", { autorizacion: "SUP-01:1234" })).status, 400);

  const bloqueado = await registrar("BLOQ", { autorizacion: { supervisor_id: "SUP-BLOQ", pin: "1234" } });
  assert.equal(bloqueado.status, 423);
  assert.match(bloqueado.cuerpo.mensaje, /bloqueado/);

  const caida = await registrar("CAIDA", { autorizacion: { supervisor_id: "SUP-ROTO", pin: "1234" } });
  assert.equal(caida.status, 502);
  for (const letra of ["PIN", "BLOQ", "CAIDA"]) assert.equal(await cuantas(letra), 0, letra);
});

test("TDSI-1085: hasta el limite no se pide ni se valida el PIN", async () => {
  const antes = validaciones.length;
  const r = await registrar("BAJA2", { autorizacion: { supervisor_id: "SUP-01", pin: "9999" } });
  assert.equal(r.status, 201);
  assert.equal(r.cuerpo.data.requiere_autorizacion, false);
  assert.equal(r.cuerpo.data.autorizacion, null);
  assert.equal(validaciones.length, antes);
});
