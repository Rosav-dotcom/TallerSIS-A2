// TDSI-73/1017 (lado Devoluciones): POST /api/devoluciones/:codigo/nota-credito. Facturacion
// (POST/GET /api/notas-credito) se reemplaza por un servidor falso; las devoluciones van a la BD
// real y se borran al final (el correlativo DEV- vuelve a su valor).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const SUF = String(Date.now()).slice(-8);
const FACTURA = `T73-${SUF}`;
const notas = new Map(); // numero -> nota
const pedidos = [];
let siguiente = 1;
let modo = "normal"; // "normal" | "pasa-total" | "caida"

const falso = express();
falso.use(express.json());
falso.post("/api/notas-credito", (req, res) => {
  pedidos.push(req.body);
  if (modo === "caida") return res.status(500).json({ ok: false });
  if (modo === "pasa-total") {
    return res.status(422).json({ ok: false, mensaje: "No se puede emitir una nota de crédito por más del total de la factura.", detalle: { disponible: 5 } });
  }
  const ya = [...notas.values()].find((x) => x.devolucion_codigo === req.body.devolucion_codigo);
  if (ya) return res.status(409).json({ ok: false, mensaje: "ya tiene", detalle: { numero: ya.numero } });
  const numero = `NC-${String(900000 + siguiente++)}`;
  const nota = {
    numero, factura_original: { numero: req.body.factura_numero }, devolucion_codigo: req.body.devolucion_codigo,
    motivo: req.body.motivo, monto: req.body.monto, estado: "EMITIDA", emitida_por: req.body.emitida_por,
    emitida_en: new Date().toISOString(), items: req.body.items, pdf_url: `/api/notas-credito/${numero}/pdf`,
  };
  notas.set(numero, nota);
  res.status(201).json({ ok: true, data: nota });
});
falso.get("/api/notas-credito/:numero", (req, res) => {
  const n = notas.get(req.params.numero);
  return n ? res.json({ ok: true, data: n }) : res.status(404).json({ ok: false });
});

let servidorFalso, servidor, base, query, pool, repo, correlativoInicial, motivoId;
const creados = [];

async function crear(observaciones = "Fecha 20/11") {
  const d = await repo.crear({
    factura_numero: FACTURA, fecha_venta: new Date(), dentro_de_plazo: true, tipo: "PARCIAL", motivo_id: motivoId,
    observaciones, metodo_pago_original: "Efectivo", monto_total: 27, opcion_reembolso: "EFECTIVO", creado_por: "ana@test.com",
  }, [
    { factura_item_id: 1, descripcion: "Aceite 900ml", cantidad: 1, precio_unitario: 15, subtotal: 15 },
    { factura_item_id: 2, descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12, subtotal: 12 },
  ]);
  creados.push(Number(d.codigo.slice(4)));
  return d;
}
const emitir = async (codigo, cuerpo = { usuario: "ana@test.com" }) => {
  const r = await fetch(`${base}/${codigo}/nota-credito`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return { status: r.status, cuerpo: await r.json() };
};
const detalle = async (codigo) => (await (await fetch(`${base}/${codigo}`)).json()).data;

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.FACTURACION_URL = `http://localhost:${servidorFalso.address().port}`;
  ({ query, pool } = require("../config/db"));
  repo = require("../data/devolucionesRepo");
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  motivoId = Number((await query("SELECT id FROM devoluciones.motivos WHERE nombre = 'Producto vencido'")).rows[0].id);
  const app = require("../app");
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero = $1", [FACTURA]);
  if (creados.length) {
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2", [correlativoInicial, Math.max(...creados)]);
  }
  await pool.end();
});

test("TDSI-1016: pide la nota a Facturacion con los datos de la devolucion y guarda su numero", async () => {
  const d = await crear();
  const { status, cuerpo } = await emitir(d.codigo.toLowerCase());
  assert.equal(status, 201);
  assert.equal(cuerpo.mensaje, `Nota de crédito ${cuerpo.data.numero} emitida.`);
  assert.deepEqual(pedidos.at(-1), {
    factura_numero: FACTURA, devolucion_codigo: d.codigo, monto: 27,
    motivo: `Devolución ${d.codigo} · Producto vencido · Fecha 20/11`, emitida_por: "ana@test.com",
    items: [{ descripcion: "Aceite 900ml", cantidad: 1, precio_unitario: 15 }, { descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12 }],
  });
  const ref = (await detalle(d.codigo)).nota_credito;
  assert.deepEqual([ref.numero, ref.monto, ref.estado], [cuerpo.data.numero, 27, "EMITIDA"]);
});

test("TDSI-1016: una devolucion tiene una sola nota (409 sin volver a pedirla)", async () => {
  const d = await crear();
  const primera = await emitir(d.codigo);
  const antes = pedidos.length;
  const otra = await emitir(d.codigo);
  assert.equal(otra.status, 409);
  assert.equal(otra.cuerpo.mensaje, `La devolución ${d.codigo} ya tiene la nota de crédito ${primera.cuerpo.data.numero}.`);
  assert.equal(pedidos.length, antes);
});

test("TDSI-1016: si Facturacion ya la habia emitido (intento anterior), se recupera la misma", async () => {
  const d = await crear();
  const primera = await emitir(d.codigo);
  // se pierde la referencia local (como si la transaccion de aqui no hubiera terminado)
  await query("DELETE FROM devoluciones.notas_credito WHERE numero = $1", [primera.cuerpo.data.numero]);
  const otra = await emitir(d.codigo);
  assert.equal(otra.status, 201);
  assert.equal(otra.cuerpo.data.numero, primera.cuerpo.data.numero);
  assert.equal((await detalle(d.codigo)).nota_credito.numero, primera.cuerpo.data.numero);
});

test("TDSI-1050: una devolucion RECHAZADA no genera nota de credito (ni se le pide a Facturacion)", async () => {
  const d = await crear();
  await repo.cambiarEstado(d.codigo, "RECHAZADA", { usuario: "ana", extra: { motivo_rechazo: "No procede" } });
  const antes = pedidos.length;
  const r = await emitir(d.codigo);
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.mensaje, "La devolución está RECHAZADA: no genera nota de crédito.");
  assert.equal(pedidos.length, antes);
  assert.equal((await detalle(d.codigo)).nota_credito, null);
});

test("TDSI-1017: Facturacion rechaza (pasa el total) o no responde -> el mismo error / 502, sin referencia", async () => {
  const d = await crear();
  modo = "pasa-total";
  try {
    const r = await emitir(d.codigo);
    assert.equal(r.status, 422);
    assert.equal(r.cuerpo.mensaje, "No se puede emitir una nota de crédito por más del total de la factura.");
    modo = "caida";
    const caida = await emitir(d.codigo);
    assert.equal(caida.status, 502);
  } finally {
    modo = "normal";
  }
  assert.equal((await detalle(d.codigo)).nota_credito, null);
});

test("TDSI-1016: usuario obligatorio y devolucion inexistente", async () => {
  const d = await crear();
  for (const cuerpo of [{}, { usuario: "  " }, { usuario: 5 }]) {
    const r = await emitir(d.codigo, cuerpo);
    assert.equal(r.status, 400, JSON.stringify(cuerpo));
    assert.match(r.cuerpo.mensaje, /^Indique quién emite la nota de crédito/);
  }
  assert.equal((await emitir("DEV-9999999999")).status, 404);
  assert.equal((await emitir("no-es-codigo")).status, 404);
});
