// TDSI-77/1042: aviso a Inventario -- el mensaje devolucion_stock, los reintentos (maximo 5, luego
// Error) y la idempotencia, y las PA TDSI-1044 a TDSI-1047. Pub/Sub (publicar y leer acuses) se
// simula; las devoluciones y sus avisos van a la BD real y se borran al final (el correlativo
// DEV- vuelve a su valor). La configuracion se fija ANTES de cargar los modulos.
process.env.INVENTARIO_PUBSUB_TOPIC = "projects/proyecto-prueba/topics/inventario-prueba";
process.env.INVENTARIO_ACUSES_SUBSCRIPTION = "projects/proyecto-prueba/subscriptions/grupo-a-sub";
process.env.INVENTARIO_MAX_INTENTOS = "5";
process.env.INVENTARIO_BACKOFF_BASE_SEG = "30";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { query, pool } = require("../config/db");
const devolucionesRepo = require("../data/devolucionesRepo");
const notificacionesRepo = require("../data/notificacionesInventarioRepo");
const { usarClienteDePrueba } = require("../clients/pubsubPublisher");
const subscriber = require("../clients/pubsubSubscriber");
const { procesarPendientes } = require("../jobs/reintentoInventario");
const { procesarAcuses } = require("../jobs/acusesInventario");
const { interpretar } = require("../services/acusesInventarioService");
const cfg = require("../config/inventario");

const FACTURA = `T77-${String(Date.now()).slice(-8)}`;
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
const creados = [];
let servidor, base, correlativoInicial;

// ---------- Pub/Sub simulado ----------
let falso;
function clienteFalso() {
  const f = { publicados: [], fallas: [] };
  f.topic = () => ({
    publishMessage: async (msg) => {
      const falla = f.fallas.shift();
      if (falla) throw falla;
      f.publicados.push(msg);
      return `msg-${f.publicados.length}`;
    },
  });
  return f;
}
const errorGrpc = (code, message) => Object.assign(new Error(message), { code });

const bandeja = { mensajes: [], ack: [], liberados: [] };
subscriber.usarClienteDePrueba({
  pull: async () => [{
    receivedMessages: bandeja.mensajes.splice(0).map((texto, i) => ({ ackId: `ack-${i}-${texto.length}`, message: { messageId: `m${i}`, data: Buffer.from(texto) } })),
  }],
  acknowledge: async ({ ackIds }) => { bandeja.ack.push(...ackIds); },
  modifyAckDeadline: async ({ ackIds }) => { bandeja.liberados.push(...ackIds); },
});
const acuse = (codigo, extra) =>
  JSON.stringify({ sistema_origen: "INVENTARIO", tipo_mensaje: "acuse_devolucion_stock", referencia_externa: codigo, ...extra });

// ---------- datos ----------
async function crear(estado = null) {
  const d = await devolucionesRepo.crear({
    factura_numero: FACTURA, fecha_venta: new Date(), dentro_de_plazo: true, tipo: "PARCIAL",
    metodo_pago_original: "Efectivo", monto_total: 25, opcion_reembolso: "VALE", creado_por: "ana@test.com",
  }, [
    { factura_item_id: 11, codigo_producto: "ACE-900", descripcion: "Aceite 900ml", cantidad: 2, precio_unitario: 10, subtotal: 20, condicion: "REINGRESO" },
    { factura_item_id: 12, descripcion: "Arroz 1kg", cantidad: 1, precio_unitario: 5, subtotal: 5, condicion: "MERMA" },
  ]);
  creados.push(Number(d.codigo.slice(4)));
  if (estado) await devolucionesRepo.cambiarEstado(d.codigo, estado, { usuario: "sup@test.com" });
  return { ...d, id: Number(d.id) }; // BIGINT llega como texto
}
const post = async (ruta, cuerpo = { usuario: "ana.encargada@test.com" }) => {
  const r = await fetch(`${base}${ruta}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return { status: r.status, cuerpo: await r.json() };
};
const detalle = async (codigo) => (await (await fetch(`${base}/${codigo}`)).json()).data;
const vencer = (devolucionId) => query(
  "UPDATE devoluciones.notificaciones_inventario SET proximo_intento_en = now() - interval '1 second' WHERE devolucion_id = $1",
  [devolucionId]
);
const aviso = async (id) => (await query("SELECT * FROM devoluciones.notificaciones_inventario WHERE devolucion_id = $1", [id])).rows;

test.before(async () => {
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});
test.beforeEach(() => {
  cfg.PUBSUB_TOPIC = "projects/proyecto-prueba/topics/inventario-prueba";
  falso = clienteFalso();
  usarClienteDePrueba(falso);
});
test.after(async () => {
  usarClienteDePrueba(null);
  await new Promise((ok) => servidor.close(ok));
  await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero = $1", [FACTURA]);
  if (creados.length) {
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2", [correlativoInicial, Math.max(...creados)]);
  }
  await pool.end();
});

// ---------- mensaje ----------
test("TDSI-1044: al procesar una devolucion se publica devolucion_stock y la columna Inventario pasa a Enviado", async () => {
  const d = await crear();
  const { status, cuerpo } = await post(`/${d.codigo}/procesar`);
  assert.equal(status, 200);
  assert.equal(cuerpo.mensaje, `Devolución ${d.codigo} procesada.`);
  assert.equal(cuerpo.data.estado, "PROCESADA");
  assert.deepEqual(
    [cuerpo.data.inventario.estado, cuerpo.data.inventario.texto, cuerpo.data.inventario.intentos, cuerpo.data.inventario.puede_reenviar],
    ["ENVIADO", "Enviado", 1, false]
  );
  assert.equal((await (await fetch(`${base}?codigo=${d.codigo}`)).json()).data[0].inventario, "ENVIADO");

  const [{ json, attributes }] = falso.publicados;
  assert.deepEqual(json, {
    sistema_origen: "DEVOLUCIONES",
    tipo_mensaje: "devolucion_stock",
    referencia_externa: d.codigo,
    mensaje_id: `${d.codigo}-1`,
    fecha_documento: hoy(),
    datos: {
      factura_numero: FACTURA,
      tipo: "PARCIAL",
      items: [
        { codigo_producto: "ACE-900", descripcion: "Aceite 900ml", cantidad: 2, condicion: "REINGRESO" },
        { codigo_producto: null, descripcion: "Arroz 1kg", cantidad: 1, condicion: "MERMA" },
      ],
    },
  });
  assert.deepEqual(attributes, {
    tipo: "DEVOLUCION_STOCK", referencia_externa: d.codigo, idempotency_key: `${d.codigo}-1`, origen: "devoluciones", grupo: "A",
  });
  // el historial lo deja con usuario y hora (TDSI-81)
  const historial = (await (await fetch(`${base}/${d.codigo}/historial`)).json()).data.historial;
  assert.deepEqual([historial.at(-1).estado_nuevo, historial.at(-1).usuario, historial.at(-1).comentario],
    ["PROCESADA", "ana.encargada@test.com", "Devolución procesada · aviso a Inventario"]);
});

test("TDSI-231: solo se procesa una PENDIENTE o APROBADA; una RECHAZADA no avisa a Inventario", async () => {
  const aprobada = await crear("APROBADA");
  assert.equal((await post(`/${aprobada.codigo}/procesar`)).status, 200);
  const otra = await post(`/${aprobada.codigo}/procesar`);
  assert.equal(otra.status, 409);
  assert.equal(otra.cuerpo.mensaje, `La devolución ${aprobada.codigo} ya fue procesada.`);
  assert.equal(falso.publicados.length, 1);

  const rechazada = await crear();
  await devolucionesRepo.cambiarEstado(rechazada.codigo, "RECHAZADA", { usuario: "ana", extra: { motivo_rechazo: "No procede" } });
  const r = await post(`/${rechazada.codigo}/procesar`);
  assert.equal(r.status, 409);
  assert.match(r.cuerpo.mensaje, /está RECHAZADA/);
  assert.deepEqual(await aviso(rechazada.id), []);
  assert.equal((await detalle(rechazada.codigo)).inventario, null);

  const d = await crear();
  for (const cuerpo of [{}, { usuario: "  " }]) {
    const sin = await post(`/${d.codigo}/procesar`, cuerpo);
    assert.equal(sin.status, 400);
    assert.match(sin.cuerpo.mensaje, /^Indique quién procesa la devolución/);
  }
  assert.equal((await post("/DEV-9999999999/procesar")).status, 404);
});

// ---------- reintentos ----------
test("TDSI-1039: si Pub/Sub falla la devolucion igual queda PROCESADA y el aviso Pendiente (no se pierde)", async () => {
  const d = await crear();
  falso.fallas.push(errorGrpc(14, "UNAVAILABLE"));
  const { cuerpo } = await post(`/${d.codigo}/procesar`);
  assert.equal(cuerpo.data.estado, "PROCESADA");
  assert.deepEqual([cuerpo.data.inventario.estado, cuerpo.data.inventario.intentos], ["PENDIENTE", 1]);
  assert.match(cuerpo.data.inventario.ultimo_error, /UNAVAILABLE/);

  await vencer(d.id);
  const resultados = (await procesarPendientes()).filter((x) => x.devolucion_id === d.id);
  assert.deepEqual(resultados.map((x) => [x.estado, x.intentos]), [["ENVIADO", 2]]);
});

test("TDSI-1039: hasta 5 intentos con espera creciente y luego Error", async () => {
  const d = await crear();
  for (let i = 0; i < 6; i++) falso.fallas.push(errorGrpc(14, "UNAVAILABLE"));
  await post(`/${d.codigo}/procesar`);
  const esperas = [];
  for (let intento = 2; intento <= 5; intento++) {
    const [antes] = await aviso(d.id);
    esperas.push(Math.round((new Date(antes.proximo_intento_en) - new Date(antes.ultimo_intento_en)) / 1000));
    await vencer(d.id);
    const [r] = (await procesarPendientes()).filter((x) => x.devolucion_id === d.id);
    assert.equal(r.intentos, intento);
    assert.equal(r.estado, intento < 5 ? "PENDIENTE" : "ERROR");
  }
  assert.deepEqual(esperas, [30, 60, 120, 240]); // base, base*2, base*4, base*8
  const [final] = await aviso(d.id);
  assert.equal(final.proximo_intento_en, null);
  await vencer(d.id);
  assert.equal((await procesarPendientes()).filter((x) => x.devolucion_id === d.id).length, 0); // ya no se reintenta
  const inv = (await detalle(d.codigo)).inventario;
  assert.deepEqual([inv.estado, inv.texto, inv.puede_reenviar], ["ERROR", "Error", true]);
});

test("TDSI-1039: un error que no se arregla reintentando va directo a Error; sin topico espera sin gastar intentos", async () => {
  const d = await crear();
  falso.fallas.push(errorGrpc(7, "PERMISSION_DENIED"));
  const { cuerpo } = await post(`/${d.codigo}/procesar`);
  assert.deepEqual([cuerpo.data.inventario.estado, cuerpo.data.inventario.intentos], ["ERROR", 1]);

  const sinTopico = await crear();
  cfg.PUBSUB_TOPIC = null;
  const r = await post(`/${sinTopico.codigo}/procesar`);
  assert.equal(r.cuerpo.data.estado, "PROCESADA");
  assert.deepEqual([r.cuerpo.data.inventario.estado, r.cuerpo.data.inventario.intentos], ["PENDIENTE", 0]);
  assert.match(r.cuerpo.data.inventario.ultimo_error, /INVENTARIO_PUBSUB_TOPIC/);
  assert.equal(falso.publicados.length, 0);
  // al configurarlo, el worker lo envia
  cfg.PUBSUB_TOPIC = "projects/proyecto-prueba/topics/inventario-prueba";
  await vencer(sinTopico.id);
  const [enviado] = (await procesarPendientes()).filter((x) => x.devolucion_id === sinTopico.id);
  assert.deepEqual([enviado.estado, enviado.intentos], ["ENVIADO", 1]);
});

// ---------- idempotencia ----------
test("TDSI-1042: idempotencia -- un solo aviso por devolucion y los reintentos repiten el mismo mensaje_id", async () => {
  const d = await crear();
  falso.fallas.push(errorGrpc(14, "UNAVAILABLE"));
  await post(`/${d.codigo}/procesar`);
  await vencer(d.id);
  await procesarPendientes();
  assert.deepEqual(falso.publicados.map((m) => m.json.mensaje_id), [`${d.codigo}-1`]);
  assert.equal(falso.publicados[0].attributes.idempotency_key, `${d.codigo}-1`);

  // la BD no deja un segundo aviso para la misma devolucion
  const cliente = await pool.connect();
  try {
    assert.equal(await notificacionesRepo.crearEnTransaccion(cliente, { devolucionId: d.id, payload: {} }), null);
  } finally {
    cliente.release();
  }
  assert.equal((await aviso(d.id)).length, 1);

  // dos workers a la vez (dos instancias del servicio) no toman el mismo aviso: FOR UPDATE SKIP LOCKED
  const otra = await crear();
  falso.fallas.push(errorGrpc(14, "UNAVAILABLE"));
  await post(`/${otra.codigo}/procesar`);
  await vencer(otra.id);
  const tandas = await Promise.all([notificacionesRepo.tomarPendientes(10), notificacionesRepo.tomarPendientes(10)]);
  assert.equal(tandas.flat().filter((x) => x.devolucion_id === otra.id).length, 1);
});

// ---------- acuses ----------
test("TDSI-1045: al llegar el acuse confirmado pasa a Confirmado", async () => {
  const d = await crear();
  await post(`/${d.codigo}/procesar`);
  bandeja.mensajes.push(acuse(d.codigo, { mensaje_id: `${d.codigo}-1`, estado: "confirmado" }));
  const r = await procesarAcuses();
  assert.ok(r.some((x) => x.codigo === d.codigo && x.estado === "CONFIRMADO"));
  const inv = (await detalle(d.codigo)).inventario;
  assert.deepEqual([inv.estado, inv.texto, inv.puede_reenviar], ["CONFIRMADO", "Confirmado", false]);
  assert.ok(inv.resultado_en);
});

test("TDSI-1046: si Inventario rechaza se ve el motivo y el boton Reenviar", async () => {
  const d = await crear();
  await post(`/${d.codigo}/procesar`);
  bandeja.mensajes.push(acuse(d.codigo, { mensaje_id: `${d.codigo}-1`, estado: "Rechazado", motivo: "El producto ACE-900 no existe en el almacén" }));
  await procesarAcuses();
  const inv = (await detalle(d.codigo)).inventario;
  assert.deepEqual([inv.estado, inv.texto, inv.motivo_rechazo, inv.puede_reenviar],
    ["RECHAZADO", "Rechazado", "El producto ACE-900 no existe en el almacén", true]);

  // sin motivo, se avisa igual
  const sinMotivo = await crear();
  await post(`/${sinMotivo.codigo}/procesar`);
  bandeja.mensajes.push(acuse(sinMotivo.codigo, { estado: "rechazado" }));
  await procesarAcuses();
  assert.equal((await detalle(sinMotivo.codigo)).inventario.motivo_rechazo, "Inventario rechazó el aviso sin indicar el motivo.");
});

test("TDSI-1047: al presionar Reenviar se vuelve a enviar el aviso (nueva version) y se actualiza el estado", async () => {
  const d = await crear();
  await post(`/${d.codigo}/procesar`);
  bandeja.mensajes.push(acuse(d.codigo, { mensaje_id: `${d.codigo}-1`, estado: "rechazado", motivo: "Sin stock de referencia" }));
  await procesarAcuses();

  const { status, cuerpo } = await post(`/${d.codigo}/inventario/reenviar`, {});
  assert.equal(status, 200);
  assert.equal(cuerpo.mensaje, `Aviso de ${d.codigo} reenviado a Inventario.`);
  assert.deepEqual([cuerpo.data.inventario.estado, cuerpo.data.inventario.version, cuerpo.data.inventario.intentos, cuerpo.data.inventario.motivo_rechazo],
    ["ENVIADO", 2, 1, null]);
  assert.deepEqual(falso.publicados.map((m) => m.json.mensaje_id), [`${d.codigo}-1`, `${d.codigo}-2`]);
  assert.equal(falso.publicados[1].attributes.idempotency_key, `${d.codigo}-2`);

  // un acuse atrasado de la version 1 no pisa la version 2
  bandeja.mensajes.push(acuse(d.codigo, { mensaje_id: `${d.codigo}-1`, estado: "rechazado", motivo: "viejo" }));
  await procesarAcuses();
  assert.equal((await detalle(d.codigo)).inventario.estado, "ENVIADO");
  bandeja.mensajes.push(acuse(d.codigo, { mensaje_id: `${d.codigo}-2`, estado: "confirmado" }));
  await procesarAcuses();
  assert.equal((await detalle(d.codigo)).inventario.estado, "CONFIRMADO");

  // reenviar solo en Error o Rechazado; sin procesar o inexistente
  const r = await post(`/${d.codigo}/inventario/reenviar`, {});
  assert.equal(r.status, 409);
  assert.match(r.cuerpo.mensaje, /está CONFIRMADO/);
  const sinProcesar = await crear();
  assert.equal((await post(`/${sinProcesar.codigo}/inventario/reenviar`, {})).status, 409);
  assert.equal((await post("/DEV-9999999999/inventario/reenviar", {})).status, 404);
});

test("TDSI-1040: los mensajes que no son acuses nuestros se liberan para los demas servicios", async () => {
  const liberadosAntes = bandeja.liberados.length;
  const ackAntes = bandeja.ack.length;
  bandeja.mensajes.push(
    JSON.stringify({ sistema_origen: "CONTABILIDAD", tipo_mensaje: "resultado_documento", referencia_externa: "F-000001", estado: "aceptado" }),
    acuse("DEV-9999999999", { estado: "confirmado" }), // devolucion que no es de esta base
    "no es json"
  );
  const r = await procesarAcuses();
  assert.equal(r.length, 0);
  assert.equal(bandeja.liberados.length - liberadosAntes, 3);
  assert.equal(bandeja.ack.length - ackAntes, 0);

  assert.equal(interpretar(acuse("DEV-000001", { estado: "otro" })), null);
  assert.equal(interpretar(acuse("DEV-000001", { estado: "confirmado", mensaje_id: "DEV-000002-1" })), null);
  assert.deepEqual(interpretar(acuse("dev-000001", { estado: "CONFIRMADO", mensaje_id: "DEV-000001-3" })),
    { codigo: "DEV-000001", version: 3, estado: "CONFIRMADO", motivo: null });
});
