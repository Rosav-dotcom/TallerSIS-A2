// TDSI-73/1018: la nota de credito se publica en el topico de Contabilidad (tipo nota_credito,
// referencia NC-<numero>) con el mismo publicador, reintentos y "Reenviar" que las facturas.
// Pub/Sub simulado (no publica en Google); BD real, las facturas de prueba se borran al final.
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
process.env.CONTABILIDAD_MAX_INTENTOS = "3";

const test = require("node:test");
const assert = require("node:assert/strict");
const facturasService = require("../services/facturasService");
const contabilidad = require("../services/contabilidadService");
const { emitirNotaCredito } = require("../services/notasCreditoService");
const { procesarPendientes } = require("../jobs/reintentoEnviosContabilidad");
const { usarClienteDePrueba } = require("../clients/pubsubPublisher");
const cfg = require("../config/contabilidad");
const { pool } = require("../config/db");

const NIT = `1018${String(Date.now()).slice(-6)}`;
const creadas = [];
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });

function clienteFalso() {
  const falso = { publicados: [], fallas: [] };
  falso.topic = () => ({
    publishMessage: async (msg) => {
      const falla = falso.fallas.shift();
      if (falla) throw falla;
      falso.publicados.push(msg);
      return `msg-${falso.publicados.length}`;
    },
  });
  return falso;
}
const errorGrpc = (code, message) => Object.assign(new Error(message), { code });

async function nuevaFactura() {
  const f = await facturasService.crearFactura({
    nit: NIT, razon_social: "Cliente Contable S.R.L.", metodos: [{ metodo: "Efectivo" }],
    items: [{ descripcion: "Aceite 900ml", cantidad: 3, precio_unitario: 15 }, { descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12 }],
  });
  creadas.push(f.id);
  return f;
}
const emitir = (factura, extra = {}) => emitirNotaCredito({
  factura_numero: factura.numero, motivo: "Devolución DEV-000123 · Producto vencido", emitida_por: "ana@test.com",
  items: [{ descripcion: "Aceite 900ml", cantidad: 1, precio_unitario: 15 }], ...extra,
});
const vencer = (id) =>
  pool.query("UPDATE facturacion.factura_envios_contabilidad SET proximo_intento_en = now() - interval '1 second' WHERE id = $1", [id]);
const enviosDe = async (facturaId) => (await pool.query(
  "SELECT tipo, estado, nota_credito_id FROM facturacion.factura_envios_contabilidad WHERE factura_id = $1 ORDER BY id", [facturaId]
)).rows;

let falso;
test.beforeEach(() => {
  cfg.PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
  falso = clienteFalso();
  usarClienteDePrueba(falso);
});
test.after(async () => {
  usarClienteDePrueba(null);
  if (creadas.length) await pool.query("DELETE FROM facturacion.facturas WHERE id = ANY($1::bigint[])", [creadas]);
  await pool.query("DELETE FROM facturacion.clientes_frecuentes WHERE nit = $1", [NIT]);
  await pool.end();
});

test("TDSI-1018: al emitir, la nota se publica como 'nota_credito' con referencia NC-<numero> (y antes la venta)", async () => {
  const f = await nuevaFactura();
  const { nota, contabilidad: envio } = await emitir(f);
  assert.equal(envio.estado, "Enviado");
  assert.equal(envio.tipo, "nota_credito");
  assert.equal(envio.nota_credito_numero, nota.numero);
  assert.equal(envio.intentos, 1);

  // la venta no se habia enviado: va primero, luego la nota
  assert.deepEqual(falso.publicados.map((m) => m.json.tipo_operacion), ["venta", "nota_credito"]);
  const { json, attributes } = falso.publicados[1];
  assert.deepEqual(json, {
    sistema_origen: "FACTURACION",
    referencia_externa: nota.numero,
    tipo_operacion: "nota_credito",
    fecha_documento: hoy(),
    datos: {
      fecha_documento: hoy(),
      id_documento_original: f.numero,
      tipo_documento_original: "venta",
      nit_cliente: NIT,
      nombre_cliente: "Cliente Contable S.R.L.",
      monto: 15,
      motivo: "Devolución DEV-000123 · Producto vencido",
      modo_impuesto: "incluido",
    },
  });
  assert.deepEqual(attributes, {
    tipo: "NOTA_CREDITO", tipo_operacion: "nota_credito", factura_id: String(f.id), referencia_externa: nota.numero,
    idempotency_key: `nota-credito-${envio.nota_credito_id}`, origen: "facturacion", grupo: "A",
  });
});

test("TDSI-1018: varias notas de una factura tienen cada una su envio; una nota se envia una sola vez", async () => {
  const f = await nuevaFactura();
  const a = await emitir(f);
  const b = await emitir(f, { items: [{ descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12 }] });
  assert.notEqual(a.contabilidad.id, b.contabilidad.id);
  assert.deepEqual((await enviosDe(f.id)).map((e) => e.tipo), ["venta", "nota_credito", "nota_credito"]);

  const otra = await contabilidad.enviarNotaCredito(a.contabilidad.nota_credito_id);
  assert.equal(otra.id, a.contabilidad.id);
  assert.equal(falso.publicados.length, 3); // venta + 2 notas, sin repetir
  // la venta sigue siendo una sola por factura
  const venta = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(venta.tipo, "venta");
  assert.equal((await enviosDe(f.id)).filter((e) => e.tipo === "venta").length, 1);
  assert.equal(falso.publicados.length, 3);
});

test("TDSI-1018: si Pub/Sub falla se reintenta con el mismo worker de las facturas", async () => {
  const f = await nuevaFactura();
  await contabilidad.enviarFactura(f.id, "venta");
  falso.fallas.push(errorGrpc(14, "UNAVAILABLE"));
  const { contabilidad: envio } = await emitir(f);
  assert.equal(envio.estado, "Pendiente");
  assert.equal(envio.intentos, 1);
  assert.match(envio.ultimo_error, /UNAVAILABLE/);

  await vencer(envio.id);
  const resultados = await procesarPendientes({ facturaId: f.id });
  assert.deepEqual(resultados.map((r) => [r.id, r.estado, r.intentos]), [[envio.id, "Enviado", 2]]);
});

test("TDSI-1018: un error que no se arregla reintentando queda en Error y se puede Reenviar", async () => {
  const f = await nuevaFactura();
  await contabilidad.enviarFactura(f.id, "venta");
  falso.fallas.push(errorGrpc(7, "PERMISSION_DENIED"));
  const { contabilidad: envio } = await emitir(f);
  assert.equal(envio.estado, "Error");

  const reenviado = await contabilidad.reenviarEnvio(envio.id);
  assert.equal(reenviado.estado, "Enviado");
  assert.equal(reenviado.tipo, "nota_credito");
  const lista = await contabilidad.listarEnvios({ tipo: "nota_credito", limite: 200 });
  assert.ok(lista.envios.some((e) => e.id === envio.id && e.nota_credito_numero === reenviado.nota_credito_numero));
});

test("TDSI-1018: la nota espera a que la venta llegue a Contabilidad (sin gastar intentos)", async () => {
  const f = await nuevaFactura();
  falso.fallas.push(errorGrpc(7, "PERMISSION_DENIED")); // la venta queda en Error
  const venta = await contabilidad.enviarFactura(f.id, "venta");
  assert.equal(venta.estado, "Error");

  const { contabilidad: envio } = await emitir(f);
  assert.equal(envio.estado, "Pendiente");
  assert.equal(envio.intentos, 0);
  assert.equal(envio.ultimo_error, "Esperando que la venta llegue a Contabilidad");

  await contabilidad.reenviarEnvio(venta.id);
  await vencer(envio.id);
  const [r] = await procesarPendientes({ facturaId: f.id });
  assert.equal(r.estado, "Enviado");
  assert.deepEqual(falso.publicados.map((m) => m.json.tipo_operacion), ["venta", "nota_credito"]);
});

test("TDSI-1018: sin topico configurado la nota se emite igual y no se registra envio", async () => {
  const f = await nuevaFactura();
  cfg.PUBSUB_TOPIC = null;
  const { nota, contabilidad: envio } = await emitir(f);
  assert.match(nota.numero, /^NC-/);
  assert.deepEqual(envio, { publicado: false, motivo: "CONTABILIDAD_PUBSUB_TOPIC no esta configurado" });
  assert.deepEqual(await enviosDe(f.id), []);
});
