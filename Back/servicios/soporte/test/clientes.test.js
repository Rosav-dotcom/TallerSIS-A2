// TDSI-973: clientes HTTP de Soporte con fetch simulado (sin red)
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearGestionPagosClient } = require("../src/clients/gestionPagosClient");
const { crearFacturacionClient } = require("../src/clients/facturacionClient");

const respuesta = (status, cuerpo) => ({ status, ok: status >= 200 && status < 300, json: async () => cuerpo });

// fetch simulado de gestion_pagos: entrega tokens numerados y acepta solo el último
function gestionPagosFalso() {
  const llamadas = [];
  let emitidos = 0;
  let vigente = null;
  const fetchImpl = async (url, opciones = {}) => {
    llamadas.push(url);
    if (url.endsWith("/auth/token")) {
      const { client_secret } = JSON.parse(opciones.body);
      if (client_secret !== "secreto") return respuesta(401, { ok: false, mensaje: "Credenciales inválidas" });
      vigente = `tok-${++emitidos}`;
      return respuesta(200, { ok: true, data: { access_token: vigente, expires_in: 900 } });
    }
    if (opciones.headers.Authorization !== `Bearer ${vigente}`) return respuesta(401, { ok: false, mensaje: "Token inválido" });
    if (url.endsWith("/historial")) return respuesta(200, { ok: true, data: [{ estado_nuevo: "APROBADA" }] });
    if (url.endsWith("/TX-9")) return respuesta(404, { ok: false, mensaje: "Transacción no encontrada" });
    return respuesta(200, { ok: true, data: { id_transaccion: "TX-1", total: 100 } });
  };
  return { fetchImpl, llamadas, revocar: () => { vigente = "otro"; }, tokens: () => emitidos };
}

const armar = (falso, extra = {}) =>
  crearGestionPagosClient({ baseUrl: "http://pagos", clientId: "soporte", clientSecret: "secreto", fetchImpl: falso.fetchImpl, ...extra });

test("pide el token una sola vez y lo reutiliza", async () => {
  const falso = gestionPagosFalso();
  const cliente = armar(falso);
  assert.equal((await cliente.obtenerTransaccion("TX-1")).id_transaccion, "TX-1");
  assert.equal((await cliente.obtenerHistorial("TX-1")).length, 1);
  assert.equal(falso.tokens(), 1);
});

test("renueva el token cuando está por vencer", async () => {
  const falso = gestionPagosFalso();
  let reloj = 0;
  const cliente = armar(falso, { ahora: () => reloj });
  await cliente.obtenerTransaccion("TX-1");
  reloj = 880 * 1000; // faltan 20 s: dentro del margen de 30 s
  await cliente.obtenerTransaccion("TX-1");
  assert.equal(falso.tokens(), 2);
});

test("si el token es rechazado (401) pide otro y reintenta una vez", async () => {
  const falso = gestionPagosFalso();
  const cliente = armar(falso);
  await cliente.obtenerTransaccion("TX-1");
  falso.revocar();
  assert.equal((await cliente.obtenerTransaccion("TX-1")).total, 100);
  assert.equal(falso.tokens(), 2);
});

test("transacción inexistente responde 404", async () => {
  const cliente = armar(gestionPagosFalso());
  await assert.rejects(cliente.obtenerTransaccion("TX-9"), (e) => e.status === 404);
});

test("sin credenciales configuradas responde 503 sin llamar a gestion_pagos", async () => {
  const falso = gestionPagosFalso();
  const cliente = armar(falso, { clientId: "", clientSecret: "" });
  await assert.rejects(cliente.obtenerTransaccion("TX-1"), (e) => e.status === 503 && /credenciales/.test(e.message));
  assert.equal(falso.llamadas.length, 0);
});

test("credenciales rechazadas responde 503 (configuración de Soporte)", async () => {
  const cliente = armar(gestionPagosFalso(), { clientSecret: "malo" });
  await assert.rejects(cliente.obtenerTransaccion("TX-1"), (e) => e.status === 503 && /rechazó/.test(e.message));
});

test("servicio caído responde 503", async () => {
  const cliente = crearFacturacionClient({
    baseUrl: "http://facturacion",
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); },
  });
  await assert.rejects(cliente.obtenerFactura("F-000123"), (e) => e.status === 503);
});

test("facturación: codifica el número en la URL y devuelve data", async () => {
  let pedida;
  const cliente = crearFacturacionClient({
    baseUrl: "http://facturacion",
    fetchImpl: async (url) => { pedida = url; return respuesta(200, { ok: true, data: { numero: "F-1" } }); },
  });
  assert.deepEqual(await cliente.obtenerFactura("F-1"), { numero: "F-1" });
  assert.equal(pedida, "http://facturacion/api/facturas/F-1");
});
