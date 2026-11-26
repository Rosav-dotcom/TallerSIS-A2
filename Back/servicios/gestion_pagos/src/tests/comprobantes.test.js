// TDSI-1122 (TDSI-79): tests del correo con el comprobante de la devolución.
// Cubren: correo inválido, falla del servidor de correo, falla de Facturación (PDF),
// reenvío (también con el correo corregido y con dos clics a la vez) y las rutas.
// Usan la base de datos (igual que los demás tests de gestion_pagos), un servidor de
// correo falso (usarTransportadorDePrueba) y un Facturación falso para el PDF.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const express = require("express");
const { pool, query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { usarTransportadorDePrueba } = require("../services/emailService");
const {
  enviarComprobante,
  reenviarComprobante,
  obtenerEnvio,
  listarEnvios,
} = require("../services/comprobantesService");
const { generarVale } = require("../services/valesService");
const sistemasRepo = require("../data/sistemasClienteRepo");
const { hashSecret } = require("../utils/secretHash");
const { generarToken } = require("../services/authService");

const SUFIJO = Date.now().toString(36).toUpperCase();
const DEV = (n) => `DEV-TC-${SUFIJO}-${n}`;
const TRX = (n) => `TCOMP-${SUFIJO}-${n}`;
const CLIENTE = `test-comprobantes-${SUFIJO}`.toLowerCase();
const PDF = Buffer.from("%PDF-1.4\n% nota de credito de prueba\n");

// ---------------------------------------------------------------------------
// Servidor de correo falso: guarda lo enviado o falla las veces que se le pida
// ---------------------------------------------------------------------------
const correo = {
  enviados: [],
  fallas: 0,
  alEnviar: null, // avisa que un envío empezó (para el test de dos clics)
  pausa: null, // promesa que detiene el envío hasta que el test la suelte
  async sendMail(mensaje) {
    if (this.alEnviar) {
      this.alEnviar();
      this.alEnviar = null;
    }
    if (this.pausa) await this.pausa;
    if (this.fallas > 0) {
      this.fallas -= 1;
      throw new Error("SMTP 421: servicio no disponible");
    }
    this.enviados.push(mensaje);
    return { messageId: `m-${this.enviados.length}` };
  },
};

// Facturación falso: responde el PDF de las notas que "existen"; caido = 503
const facturacion = { notas: new Set(["NC-000045"]), caido: false, pedidos: 0 };
let servidorFacturacion;

async function crearReversion({ estado = "CONFIRMADA", monto = 70 } = {}) {
  const confirmada = estado === "CONFIRMADA";
  const { rows } = await query(
    `INSERT INTO pagos.reversiones (id_transaccion, monto, motivo, solicitado_por, devolucion_id, estado, intentos, referencia_pasarela, confirmado_en)
     VALUES ($1, $2, 'Devolución total del producto', 'encargado@tallersis.bo', $3, $4, 1, $5, $6)
     RETURNING id`,
    [TRX(crypto.randomUUID().slice(0, 8)), monto, DEV("R"), estado, confirmada ? "PSIM-TEST-1" : null, confirmada ? new Date() : null]
  );
  return Number(rows[0].id);
}

test.before(async () => {
  servidorFacturacion = await new Promise((ok) => {
    const s = http
      .createServer((req, res) => {
        facturacion.pedidos += 1;
        const m = /^\/api\/notas-credito\/([^/]+)\/pdf$/.exec(req.url);
        if (facturacion.caido) {
          res.statusCode = 503;
          return res.end("{}");
        }
        if (!m || !facturacion.notas.has(decodeURIComponent(m[1]))) {
          res.statusCode = 404;
          return res.end('{"ok":false}');
        }
        res.setHeader("Content-Type", "application/pdf");
        res.end(PDF);
      })
      .listen(0, () => ok(s));
  });
  process.env.FACTURACION_URL = `http://127.0.0.1:${servidorFacturacion.address().port}`;
  usarTransportadorDePrueba(correo);
});

test.beforeEach(() => {
  correo.enviados = [];
  correo.fallas = 0;
  correo.alEnviar = null;
  correo.pausa = null;
  facturacion.caido = false;
  facturacion.pedidos = 0;
});

test.after(async () => {
  usarTransportadorDePrueba(undefined);
  servidorFacturacion.close();
  await query(`DELETE FROM pagos.comprobantes_envios WHERE devolucion_id LIKE $1`, [`DEV-TC-${SUFIJO}-%`]);
  await query(`DELETE FROM pagos.reversiones WHERE id_transaccion LIKE $1`, [`TCOMP-${SUFIJO}-%`]);
  await query(`DELETE FROM pagos.vales_compra WHERE devolucion_id LIKE $1`, [`DEV-TC-${SUFIJO}-%`]);
  await query(`DELETE FROM pagos.sistemas_cliente WHERE client_id = $1`, [CLIENTE]);
  await pool.end();
});

const contarEnvios = async (devolucion_id) =>
  Number((await query(`SELECT count(*) FROM pagos.comprobantes_envios WHERE devolucion_id = $1`, [devolucion_id])).rows[0].count);

// ---------------------------------------------------------------------------
// Envío correcto (TDSI-235 / TDSI-1083)
// ---------------------------------------------------------------------------

test("tarjeta: el correo lleva el comprobante con el monto de la reversión y el PDF de la nota", async () => {
  const reversion_id = await crearReversion({ monto: 70 });
  const envio = await enviarComprobante({
    email: "  Cliente@Correo.com ",
    devolucion_id: DEV(1),
    cliente: "Ana Pérez",
    nota_credito: "nc-45",
    reembolso: { reversion_id, monto: 9999 }, // el monto del cuerpo se ignora: manda la reversión
  });

  assert.equal(envio.estado, "Enviado");
  assert.equal(envio.tipo, "REEMBOLSO");
  assert.equal(envio.email, "cliente@correo.com");
  assert.equal(envio.nota_credito, "NC-000045");
  assert.equal(envio.intentos, 1);
  assert.equal(envio.simulado, false);
  assert.ok(envio.enviado_en);
  assert.equal(envio.comprobante.reembolso.monto, 70);
  assert.equal(envio.comprobante.reembolso.referencia, "PSIM-TEST-1");

  assert.equal(correo.enviados.length, 1);
  const [m] = correo.enviados;
  assert.equal(m.to, "cliente@correo.com");
  assert.match(m.subject, new RegExp(DEV(1)));
  assert.match(m.html, /Bs\. 70\.00/);
  assert.match(m.html, /Ana Pérez/);
  assert.equal(m.attachments.length, 1);
  assert.equal(m.attachments[0].filename, "NC-000045.pdf");
  assert.equal(m.attachments[0].contentType, "application/pdf");
  assert.deepEqual(m.attachments[0].content, PDF);
});

test("vale y efectivo: tipo VALE con el código del vale; efectivo sin nota no pide PDF", async () => {
  const vale = await generarVale({ monto: 45.5, devolucion_id: DEV(2), emitido_por: "encargado@tallersis.bo" });
  const conVale = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(2), reembolso: { vale_codigo: vale.codigo.toLowerCase() } });
  assert.equal(conVale.tipo, "VALE");
  assert.equal(conVale.comprobante.reembolso.monto, 45.5);
  assert.match(correo.enviados[0].html, new RegExp(vale.codigo));

  const efectivo = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(2), reembolso: { metodo: "Efectivo", monto: 19.99 } });
  assert.equal(efectivo.estado, "Enviado");
  assert.equal(efectivo.comprobante.reembolso.monto, 19.99);
  assert.deepEqual(correo.enviados[1].attachments, []);
  assert.equal(facturacion.pedidos, 0);
});

test("los datos de Devoluciones se escapan en el HTML del correo", async () => {
  await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(3), cliente: "<script>x</script>", reembolso: { metodo: "QR", monto: 5 } });
  assert.doesNotMatch(correo.enviados[0].html, /<script>/);
  assert.match(correo.enviados[0].html, /&lt;script&gt;/);
});

// ---------------------------------------------------------------------------
// Correo inválido y datos que no se aceptan (no se guarda ni se manda nada)
// ---------------------------------------------------------------------------

test("correo inválido -> 400 y no se registra ni se envía", async () => {
  for (const email of [undefined, "", "   ", "sin-arroba", "a@b", "a b@c.bo", ["a@b.bo"]]) {
    await assert.rejects(
      enviarComprobante({ email, devolucion_id: DEV(4), reembolso: { metodo: "Efectivo", monto: 10 } }),
      (e) => e.status === 400,
      JSON.stringify(email)
    );
  }
  assert.equal(await contarEnvios(DEV(4)), 0);
  assert.equal(correo.enviados.length, 0);
});

test("otros datos inválidos -> 400 / 404 / 409 sin registrar nada", async () => {
  const base = { email: "a@b.bo", devolucion_id: DEV(5) };
  const casos = [
    [{ ...base, devolucion_id: undefined, reembolso: { metodo: "QR", monto: 1 } }, 400],
    [{ ...base }, 400], // nada que enviar
    [{ ...base, nota_credito: "F-000001" }, 400],
    [{ ...base, reembolso: { metodo: "Tarjeta", monto: 10 } }, 400], // tarjeta va por reversion_id
    [{ ...base, reembolso: { metodo: "Efectivo", monto: 0 } }, 400],
    [{ ...base, reembolso: { metodo: "Efectivo", monto: 1.005 } }, 400],
    [{ ...base, reembolso: "Efectivo" }, 400],
    [{ ...base, reembolso: { reversion_id: 999999999 } }, 404],
    [{ ...base, reembolso: { vale_codigo: "VAL-ZZZZ-ZZZZ" } }, 404],
    [{ ...base, reembolso: { reversion_id: await crearReversion({ estado: "ERROR" }) } }, 409],
  ];
  for (const [body, status] of casos) {
    await assert.rejects(enviarComprobante(body), (e) => e.status === status, JSON.stringify(body));
  }
  assert.equal(await contarEnvios(DEV(5)), 0);
  assert.equal(correo.enviados.length, 0);
});

// ---------------------------------------------------------------------------
// Falla del servidor: queda en Error con el motivo
// ---------------------------------------------------------------------------

test("el servidor de correo falla -> Error con el motivo; reenviar lo manda y queda Enviado", async () => {
  correo.fallas = 1;
  const envio = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(6), nota_credito: "NC-000045", reembolso: { metodo: "Efectivo", monto: 30 } });
  assert.equal(envio.estado, "Error");
  assert.match(envio.ultimo_error, /SMTP 421/);
  assert.equal(envio.enviado_en, null);
  assert.equal(envio.puede_reenviar, true);
  assert.equal(correo.enviados.length, 0);

  const otraVez = await reenviarComprobante(envio.id);
  assert.equal(otraVez.estado, "Enviado");
  assert.equal(otraVez.intentos, 2);
  assert.equal(otraVez.ultimo_error, null);
  assert.equal(correo.enviados.length, 1);
  assert.equal(correo.enviados[0].attachments[0].filename, "NC-000045.pdf");
});

test("Facturación caída o nota inexistente -> Error sin mandar un correo sin el PDF", async () => {
  facturacion.caido = true;
  const caido = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(7), nota_credito: "NC-000045" });
  assert.equal(caido.estado, "Error");
  assert.equal(caido.tipo, "NOTA_CREDITO");
  assert.match(caido.ultimo_error, /HTTP 503/);

  facturacion.caido = false;
  const noExiste = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(7), nota_credito: "NC-000999", reembolso: { metodo: "QR", monto: 5 } });
  assert.equal(noExiste.estado, "Error");
  assert.match(noExiste.ultimo_error, /no encuentra la nota de crédito NC-000999/);
  assert.equal(correo.enviados.length, 0);

  const reenviado = await reenviarComprobante(caido.id);
  assert.equal(reenviado.estado, "Enviado");
  assert.equal(correo.enviados.length, 1);
});

test("Facturación responde algo que no es PDF -> Error", async () => {
  facturacion.notas.add("NC-000046");
  const original = servidorFacturacion.listeners("request")[0];
  servidorFacturacion.removeAllListeners("request");
  servidorFacturacion.on("request", (req, res) => { res.setHeader("Content-Type", "text/html"); res.end("<html>"); });
  try {
    const envio = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(8), nota_credito: "NC-000046" });
    assert.equal(envio.estado, "Error");
    assert.match(envio.ultimo_error, /no devolvió un PDF válido/);
  } finally {
    servidorFacturacion.removeAllListeners("request");
    servidorFacturacion.on("request", original);
  }
});

test("sin credenciales SMTP el envío se simula y queda Enviado con simulado = true", async () => {
  usarTransportadorDePrueba(null);
  try {
    const envio = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(9), reembolso: { metodo: "Efectivo", monto: 10 } });
    assert.equal(envio.estado, "Enviado");
    assert.equal(envio.simulado, true);
  } finally {
    usarTransportadorDePrueba(correo);
  }
});

// ---------------------------------------------------------------------------
// Reenvío
// ---------------------------------------------------------------------------

test("reenviar con el correo corregido (TDSI-1123) manda al nuevo y lo guarda", async () => {
  const envio = await enviarComprobante({ email: "mal@correo.bo", devolucion_id: DEV(10), reembolso: { metodo: "Efectivo", monto: 12 } });
  const corregido = await reenviarComprobante(envio.id, { email: " Bien@Correo.bo " });
  assert.equal(corregido.email, "bien@correo.bo");
  assert.equal(corregido.intentos, 2);
  assert.equal(correo.enviados[1].to, "bien@correo.bo");
  assert.equal((await obtenerEnvio(envio.id)).email, "bien@correo.bo");

  await assert.rejects(reenviarComprobante(envio.id, { email: "no-es-correo" }), (e) => e.status === 400);
  assert.equal((await obtenerEnvio(envio.id)).email, "bien@correo.bo");
});

test("reenviar: id inexistente 404, id inválido 400", async () => {
  await assert.rejects(reenviarComprobante(999999999999), (e) => e.status === 404);
  for (const id of ["abc", "0", "-1", "1.5"]) {
    await assert.rejects(reenviarComprobante(id), (e) => e.status === 400, id);
  }
});

test("dos clics en Reenviar a la vez: mientras el primero se envía, el segundo recibe 409", async () => {
  correo.fallas = 1;
  const envio = await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(11), reembolso: { metodo: "QR", monto: 8 } });
  assert.equal(envio.estado, "Error");

  // El primer reenvío se detiene justo cuando está mandando el correo (estado Pendiente).
  // No depende de la velocidad de la base: el segundo clic llega sí o sí durante el envío.
  let soltar;
  correo.pausa = new Promise((ok) => { soltar = ok; });
  const empezo = new Promise((ok) => { correo.alEnviar = ok; });
  const primero = reenviarComprobante(envio.id);
  await empezo;

  assert.equal((await obtenerEnvio(envio.id)).puede_reenviar, false);
  await assert.rejects(reenviarComprobante(envio.id), (e) => e.status === 409 && /enviando ahora mismo/.test(e.message));

  soltar();
  const terminado = await primero;
  assert.equal(terminado.estado, "Enviado");
  assert.equal(terminado.intentos, 2);
  assert.equal(correo.enviados.length, 1);
});

test("listar por devolución y por estado", async () => {
  correo.fallas = 1;
  await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(12), reembolso: { metodo: "QR", monto: 1 } });
  await enviarComprobante({ email: "a@b.bo", devolucion_id: DEV(12), reembolso: { metodo: "QR", monto: 2 } });

  assert.equal((await listarEnvios({ devolucion_id: DEV(12) })).length, 2);
  const conError = await listarEnvios({ devolucion_id: DEV(12), estado: "Error" });
  assert.equal(conError.length, 1);
  assert.equal(conError[0].comprobante.reembolso.monto, 1);
  await assert.rejects(listarEnvios({ estado: "Perdido" }), (e) => e.status === 400);
});

// ---------------------------------------------------------------------------
// Rutas HTTP
// ---------------------------------------------------------------------------

test("rutas: POST con token (201 aunque falle el correo), GET y reenviar", async () => {
  const secreto = crypto.randomBytes(16).toString("hex");
  await sistemasRepo.crear({ client_id: CLIENTE, nombre: "Devoluciones (test)", secret_hash: hashSecret(secreto) });
  const { access_token } = await generarToken({ client_id: CLIENTE, client_secret: secreto });

  const app = express();
  app.use(express.json());
  app.use("/api/pagos/comprobantes", require("../routes/comprobantesRoutes"));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/pagos/comprobantes`;
  const json = { "Content-Type": "application/json" };
  const cuerpo = JSON.stringify({ email: "a@b.bo", devolucion_id: DEV(13), nota_credito: "NC-000045", reembolso: { metodo: "Efectivo", monto: 20 } });

  try {
    assert.equal((await fetch(`${base}/reembolso`, { method: "POST", headers: json, body: cuerpo })).status, 401);
    assert.equal(await contarEnvios(DEV(13)), 0);

    correo.fallas = 1;
    const creado = await fetch(`${base}/reembolso`, { method: "POST", headers: { ...json, Authorization: `Bearer ${access_token}` }, body: cuerpo });
    assert.equal(creado.status, 201);
    const { data, mensaje } = await creado.json();
    assert.equal(data.estado, "Error");
    assert.match(mensaje, /se puede reenviar/);

    const invalido = await fetch(`${base}/reembolso`, { method: "POST", headers: { ...json, Authorization: `Bearer ${access_token}` }, body: JSON.stringify({ email: "x", devolucion_id: DEV(13) }) });
    assert.equal(invalido.status, 400);

    const detalle = await fetch(`${base}/envios/${data.id}`);
    assert.equal(detalle.status, 200);
    assert.equal((await detalle.json()).data.estado, "Error");

    const reenvio = await fetch(`${base}/envios/${data.id}/reenviar`, { method: "POST", headers: json, body: JSON.stringify({ email: "nuevo@b.bo" }) });
    assert.equal(reenvio.status, 200);
    const reenviado = (await reenvio.json()).data;
    assert.equal(reenviado.estado, "Enviado");
    assert.equal(reenviado.email, "nuevo@b.bo");

    const lista = await (await fetch(`${base}/envios?devolucion_id=${DEV(13)}`)).json();
    assert.equal(lista.total, 1);
    assert.equal((await fetch(`${base}/envios/999999999999`)).status, 404);
  } finally {
    servidor.close();
  }
});
