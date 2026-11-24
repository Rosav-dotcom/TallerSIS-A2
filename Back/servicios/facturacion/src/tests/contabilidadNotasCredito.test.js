// TDSI-73/1018: la nota de credito se publica en el topico de Contabilidad (tipo nota_credito,
// referencia NC-<numero>) con el mismo publicador, reintentos y "Reenviar" que las facturas.
// TDSI-73/1019: el acuse de Contabilidad (resultado y numero_asiento) y el estado de la tarjeta.
// Pub/Sub simulado (no publica en Google); BD real, las facturas de prueba se borran al final.
process.env.CONTABILIDAD_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/topico-prueba";
process.env.CONTABILIDAD_MAX_INTENTOS = "3";

const test = require("node:test");
const assert = require("node:assert/strict");
const facturasService = require("../services/facturasService");
const contabilidad = require("../services/contabilidadService");
const { emitirNotaCredito, obtenerNotaCredito } = require("../services/notasCreditoService");
const { interpretar, procesarMensaje } = require("../services/respuestasContabilidadService");
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

// ---------- TDSI-1019: acuse de Contabilidad ----------
const acuse = (referencia, extra) => ({
  texto: JSON.stringify({ sistema_origen: "CONTABILIDAD", tipo_mensaje: "resultado_documento", referencia_externa: referencia, ...extra }),
  messageId: `m-${referencia}`,
});

test("TDSI-1019: interpreta el acuse de una nota de credito (NC-...) sin cambiar el de las facturas", () => {
  assert.deepEqual(interpretar(acuse("NC-000007", { estado: "Aceptado", numero_asiento: 42 }).texto), {
    referencia: "NC-000007", facturaNumero: undefined, notaNumero: "NC-000007", tipo: "nota_credito",
    resultado: "aceptado", numeroAsiento: "42", motivo: null,
  });
  assert.equal(interpretar(acuse("F-000001", { estado: "aceptado" }).texto).tipo, "venta");
  assert.equal(interpretar(acuse("NC-ABC", { estado: "aceptado" }).texto), null);
});

test("TDSI-1025: la tarjeta pasa de \"Enviado a Contabilidad\" a \"Aceptado\" con el N° de asiento", async () => {
  const f = await nuevaFactura();
  const { nota } = await emitir(f);
  assert.equal(nota.contabilidad.estado, "Enviado");
  assert.equal(nota.contabilidad.texto, "Enviado a Contabilidad");
  assert.equal(nota.contabilidad.numero_asiento, null);
  assert.equal(nota.contabilidad.puede_reenviar, false);

  const r = await procesarMensaje(acuse(nota.numero, { estado: "aceptado", numero_asiento: 1025 }));
  assert.equal(r.propio, true); // se confirma (ack)
  assert.equal(r.envio.tipo, "nota_credito");
  const detalle = await obtenerNotaCredito(nota.numero);
  assert.deepEqual([detalle.contabilidad.texto, detalle.contabilidad.resultado, detalle.contabilidad.numero_asiento],
    ["Aceptado", "aceptado", "1025"]);
});

test("TDSI-1019: un rechazo de Contabilidad se ve con su motivo; un acuse de otra nota no se toma", async () => {
  const f = await nuevaFactura();
  const { nota } = await emitir(f);
  await procesarMensaje(acuse(nota.numero, { estado: "rechazado", motivo: "Periodo contable cerrado" }));
  const detalle = await obtenerNotaCredito(nota.numero);
  assert.deepEqual([detalle.contabilidad.texto, detalle.contabilidad.motivo], ["Rechazado", "Periodo contable cerrado"]);

  const ajeno = await procesarMensaje(acuse("NC-999999999", { estado: "aceptado", numero_asiento: 1 }));
  assert.equal(ajeno.propio, false); // se libera para quien mas lea la suscripcion
});

test("TDSI-1019: si el envio quedo en Error la tarjeta muestra el error y el Reenviar", async () => {
  const f = await nuevaFactura();
  await contabilidad.enviarFactura(f.id, "venta");
  falso.fallas.push(errorGrpc(7, "PERMISSION_DENIED"));
  const { nota, contabilidad: envio } = await emitir(f);
  assert.equal(nota.contabilidad.texto, "Error al enviar a Contabilidad");
  assert.equal(nota.contabilidad.puede_reenviar, true);
  assert.equal(nota.contabilidad.reenviar_url, `/api/facturas/envios-contabilidad/${envio.id}/reenviar`);
  await contabilidad.reenviarEnvio(envio.id);
  assert.equal((await obtenerNotaCredito(nota.numero)).contabilidad.texto, "Enviado a Contabilidad");

  cfg.PUBSUB_TOPIC = null;
  const sinTopico = (await emitir(f, { items: [{ descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 12 }] })).nota;
  assert.deepEqual([sinTopico.contabilidad.estado, sinTopico.contabilidad.texto], ["Sin enviar", "No enviado a Contabilidad"]);
});
