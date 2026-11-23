// TDSI-1028 (TDSI-74): tests de la reversión de pagos con tarjeta.
// Cubren: efectivo/QR no permitidos, doble reversión (también al mismo tiempo), totales
// del día sin el pago revertido, pasarela que falla con reintentos, pago mixto y las rutas.
// Usan la base de datos (igual que los demás tests de gestion_pagos) y una pasarela falsa.
process.env.PASARELA_ESPERA_MS = "0"; // sin esperas entre reintentos en los tests

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const { pool, query } = require("../config/db");
const { errorHandler } = require("../middlewares/errorHandler");
const { crearReversion, reintentarReversion, obtenerReversion, listarReversiones } = require("../services/reversionService");
const { reporteTurno } = require("../services/ventasCajeroService");
const { listarUltimasOperaciones, obtenerResumenPorCajero } = require("../services/monitoreoService");
const sistemasRepo = require("../data/sistemasClienteRepo");
const { hashSecret } = require("../utils/secretHash");
const { generarToken } = require("../services/authService");

const SUFIJO = Date.now().toString(36).toUpperCase();
const PREFIJO = `TREV-${SUFIJO}`;
const CAJA = `CAJA-${PREFIJO}`;
const CAJERO = `rev.${SUFIJO}@tallersis.bo`.toLowerCase();
const CLIENTE = `test-devoluciones-${SUFIJO}`.toLowerCase();
const INICIO = new Date(Date.now() - 60 * 1000);

const id = (nombre) => `${PREFIJO}-${nombre}`;
const BASE = { motivo: "Devolución total del producto", solicitado_por: "encargado@tallersis.bo", devolucion_id: "DEV-TEST" };

// Pasarelas falsas: siempre confirma, siempre falla, o falla las primeras N veces
const pasarelaOk = () => {
  const llamadas = [];
  return { llamadas, revertir: async (d) => { llamadas.push(d); return { referencia: `REF-${d.reversion_id}` }; } };
};
const pasarelaCaida = () => {
  let llamadas = 0;
  return { get llamadas() { return llamadas; }, revertir: async () => { llamadas += 1; throw new Error("pasarela caída"); } };
};

/** Crea una venta con una fila por método: [["Tarjeta", 70], ["Efectivo", 30]] */
async function crearVenta(nombre, metodos, { estado = "Registrado", estado_pago = "APROBADA" } = {}) {
  const tipo = metodos.length > 1 ? "Mixto" : "Simple";
  for (const [metodo, monto] of metodos) {
    await query(
      `INSERT INTO pagos.transacciones
         (id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, caja_id, cajero, cajero_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id(nombre), metodo, monto, tipo, estado, estado_pago, CAJA, CAJERO]
    );
  }
}

const estadosFilas = async (nombre) =>
  (await query(`SELECT metodo, estado FROM pagos.transacciones WHERE id_transaccion = $1 ORDER BY id`, [id(nombre)])).rows;

test.before(async () => {
  await crearVenta("TARJETA", [["Tarjeta", 120]]);
  await crearVenta("EFECTIVO", [["Efectivo", 30]]);
  await crearVenta("QR", [["QR", 15]]);
  await crearVenta("MIXTO", [["Tarjeta", 70], ["Efectivo", 30]]);
  await crearVenta("DOBLE", [["Tarjeta", 40]]);
  await crearVenta("CONCURRENTE", [["Tarjeta", 25]]);
  await crearVenta("FALLA", [["Tarjeta", 55]]);
  await crearVenta("ANULADA", [["Tarjeta", 10]], { estado: "Anulado" });
  await crearVenta("PENDIENTE", [["Tarjeta", 10]], { estado_pago: "PENDIENTE" });
  await crearVenta("TOTALES", [["Tarjeta", 200]]);
  await crearVenta("RUTA", [["Tarjeta", 80]]);
});

test.after(async () => {
  await query(`DELETE FROM pagos.reversiones WHERE id_transaccion LIKE $1`, [`${PREFIJO}-%`]);
  await query(`DELETE FROM pagos.transacciones WHERE id_transaccion LIKE $1`, [`${PREFIJO}-%`]);
  await query(`DELETE FROM pagos.sistemas_cliente WHERE client_id = $1`, [CLIENTE]);
  await pool.end();
});

// ---------------------------------------------------------------------------
// Pago con tarjeta (PA TDSI-1029)
// ---------------------------------------------------------------------------

test("un pago con tarjeta se revierte: CONFIRMADA y la fila pasa a Revertido", async () => {
  const pasarela = pasarelaOk();
  const r = await crearReversion({ id_transaccion: id("TARJETA"), ...BASE }, { pasarela });

  assert.equal(r.estado, "CONFIRMADA");
  assert.equal(r.monto, 120);
  assert.equal(r.intentos, 1);
  assert.equal(r.referencia_pasarela, `REF-${r.id}`);
  assert.equal(r.devolucion_id, "DEV-TEST");
  assert.ok(r.confirmado_en);
  assert.deepEqual(pasarela.llamadas, [{ reversion_id: r.id, id_transaccion: id("TARJETA"), monto: 120 }]);
  assert.deepEqual(await estadosFilas("TARJETA"), [{ metodo: "Tarjeta", estado: "Revertido" }]);
});

test("pago mixto: solo se revierte la parte con tarjeta y el efectivo queda Registrado", async () => {
  const r = await crearReversion({ id_transaccion: id("MIXTO"), ...BASE }, { pasarela: pasarelaOk() });
  assert.equal(r.monto, 70);
  assert.deepEqual(await estadosFilas("MIXTO"), [
    { metodo: "Tarjeta", estado: "Revertido" },
    { metodo: "Efectivo", estado: "Registrado" },
  ]);
});

// ---------------------------------------------------------------------------
// Efectivo no permitido
// ---------------------------------------------------------------------------

test("efectivo no permitido: 409 y la venta no cambia", async () => {
  const pasarela = pasarelaOk();
  await assert.rejects(
    crearReversion({ id_transaccion: id("EFECTIVO"), ...BASE }, { pasarela }),
    (e) => e.status === 409 && /Solo se revierten pagos con tarjeta/.test(e.message) && /Efectivo/.test(e.message)
  );
  assert.equal(pasarela.llamadas.length, 0);
  assert.deepEqual(await estadosFilas("EFECTIVO"), [{ metodo: "Efectivo", estado: "Registrado" }]);
  assert.equal((await listarReversiones({ id_transaccion: id("EFECTIVO") })).length, 0);
});

test("QR tampoco se revierte por la pasarela de tarjetas", async () => {
  await assert.rejects(
    crearReversion({ id_transaccion: id("QR"), ...BASE }, { pasarela: pasarelaOk() }),
    (e) => e.status === 409 && /QR/.test(e.message)
  );
});

// ---------------------------------------------------------------------------
// Doble reversión
// ---------------------------------------------------------------------------

test("doble reversión: la segunda responde 409 con la reversión que ya existe", async () => {
  const pasarela = pasarelaOk();
  const primera = await crearReversion({ id_transaccion: id("DOBLE"), ...BASE }, { pasarela });
  await assert.rejects(
    crearReversion({ id_transaccion: id("DOBLE"), ...BASE }, { pasarela }),
    (e) => e.status === 409 && /dos veces/.test(e.message) && e.detalle.reversion_id === primera.id
  );
  assert.equal(pasarela.llamadas.length, 1); // la pasarela no recibe el segundo pedido
  assert.equal((await listarReversiones({ id_transaccion: id("DOBLE") })).length, 1);
});

test("doble reversión al mismo tiempo: solo una se registra", async () => {
  const pasarela = pasarelaOk();
  const resultados = await Promise.allSettled([
    crearReversion({ id_transaccion: id("CONCURRENTE"), ...BASE }, { pasarela }),
    crearReversion({ id_transaccion: id("CONCURRENTE"), ...BASE }, { pasarela }),
  ]);
  const ok = resultados.filter((r) => r.status === "fulfilled");
  const rechazadas = resultados.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(rechazadas.length, 1);
  assert.equal(rechazadas[0].reason.status, 409);
  assert.equal(pasarela.llamadas.length, 1);
});

// ---------------------------------------------------------------------------
// Totales (PA TDSI-1030)
// ---------------------------------------------------------------------------

test("totales: un pago revertido deja de sumarse en el reporte del turno y en el monitoreo", async () => {
  const antes = await reporteTurno({ caja_id: CAJA, desde: INICIO.toISOString() });
  const resumenAntes = await obtenerResumenPorCajero({ caja_id: CAJA });

  await crearReversion({ id_transaccion: id("TOTALES"), ...BASE }, { pasarela: pasarelaOk() });
  const despues = await reporteTurno({ caja_id: CAJA, desde: INICIO.toISOString() });

  assert.equal(despues.totalTarjeta, antes.totalTarjeta - 200);
  assert.equal(despues.totalGeneral, antes.totalGeneral - 200);
  assert.equal(despues.totalEfectivo, antes.totalEfectivo); // el efectivo no cambia

  // Monitoreo en vivo: la venta se ve como REVERTIDA y el total del día baja 200
  const monitoreo = await listarUltimasOperaciones({ caja_id: CAJA, limite: 20 });
  const operaciones = monitoreo.cajeros.flatMap((c) => c.operaciones);
  const totales = operaciones.find((o) => o.id_transaccion === id("TOTALES"));
  assert.equal(totales.estado, "REVERTIDA");

  const resumenDespues = await obtenerResumenPorCajero({ caja_id: CAJA });
  assert.equal(resumenDespues.totales.total, resumenAntes.totales.total - 200);
});

test("totales: suma exacta de la caja de prueba (solo lo Registrado y aprobado)", async () => {
  // Tarjeta 120, 70, 40, 25, 200 revertidas; quedan: Efectivo 30 + QR 15 + Efectivo 30 (mixto)
  // + FALLA 55 y RUTA 80 (todavía sin revertir aquí)
  const r = await reporteTurno({ caja_id: CAJA, desde: INICIO.toISOString() });
  const { rows } = await query(
    `SELECT COALESCE(SUM(monto), 0)::float AS total FROM pagos.transacciones
      WHERE caja_id = $1 AND estado = 'Registrado' AND estado_pago = 'APROBADA'`,
    [CAJA]
  );
  assert.equal(r.totalGeneral, rows[0].total);
  assert.equal(r.totalEfectivo, 60);
  assert.equal(r.totalQR, 15);
});

// ---------------------------------------------------------------------------
// Pasarela que falla (PA TDSI-1031)
// ---------------------------------------------------------------------------

test("si la pasarela falla: 3 intentos, queda en ERROR y la venta no se revierte", async () => {
  const pasarela = pasarelaCaida();
  const r = await crearReversion({ id_transaccion: id("FALLA"), ...BASE }, { pasarela });
  assert.equal(r.estado, "ERROR");
  assert.equal(r.intentos, 3);
  assert.equal(pasarela.llamadas, 3);
  assert.match(r.ultimo_error, /pasarela caída/);
  assert.equal(r.referencia_pasarela, null);
  assert.deepEqual(await estadosFilas("FALLA"), [{ metodo: "Tarjeta", estado: "Registrado" }]);
});

test("reintentar: si vuelve a fallar suma intentos; si responde, confirma y revierte", async () => {
  const [enError] = await listarReversiones({ id_transaccion: id("FALLA") });

  const otraVez = await reintentarReversion(enError.id, { pasarela: pasarelaCaida() });
  assert.equal(otraVez.estado, "ERROR");
  assert.equal(otraVez.intentos, 6);

  const confirmada = await reintentarReversion(enError.id, { pasarela: pasarelaOk() });
  assert.equal(confirmada.estado, "CONFIRMADA");
  assert.equal(confirmada.intentos, 7);
  assert.equal(confirmada.ultimo_error, null);
  assert.deepEqual(await estadosFilas("FALLA"), [{ metodo: "Tarjeta", estado: "Revertido" }]);

  await assert.rejects(reintentarReversion(enError.id, { pasarela: pasarelaOk() }), (e) => e.status === 409);
});

// ---------------------------------------------------------------------------
// Otras reglas
// ---------------------------------------------------------------------------

test("venta anulada, cobro pendiente o venta inexistente no se revierten", async () => {
  const p = { pasarela: pasarelaOk() };
  await assert.rejects(crearReversion({ id_transaccion: id("ANULADA"), ...BASE }, p), (e) => e.status === 409 && /anulada/.test(e.message));
  await assert.rejects(crearReversion({ id_transaccion: id("PENDIENTE"), ...BASE }, p), (e) => e.status === 409 && /no está aprobado/.test(e.message));
  await assert.rejects(crearReversion({ id_transaccion: id("NO-EXISTE"), ...BASE }, p), (e) => e.status === 404);
});

test("validaciones de entrada: 400", async () => {
  const p = { pasarela: pasarelaOk() };
  const casos = [
    { ...BASE, id_transaccion: undefined },
    { ...BASE, id_transaccion: "con espacios" },
    { ...BASE, id_transaccion: id("TARJETA"), motivo: "corto" },
    { ...BASE, id_transaccion: id("TARJETA"), solicitado_por: "  " },
    { ...BASE, id_transaccion: [id("TARJETA"), id("DOBLE")] },
  ];
  for (const datos of casos) {
    await assert.rejects(crearReversion(datos, p), (e) => e.status === 400, JSON.stringify(datos));
  }
  await assert.rejects(obtenerReversion("abc"), (e) => e.status === 400);
  await assert.rejects(obtenerReversion(999999999), (e) => e.status === 404);
  await assert.rejects(listarReversiones({ estado: "OTRO" }), (e) => e.status === 400);
});

// ---------------------------------------------------------------------------
// Rutas HTTP
// ---------------------------------------------------------------------------

test("rutas: crear pide token; consultar y reintentar no", async () => {
  const secreto = crypto.randomBytes(16).toString("hex");
  await sistemasRepo.crear({ client_id: CLIENTE, nombre: "Devoluciones (test)", secret_hash: hashSecret(secreto) });
  const { access_token } = await generarToken({ client_id: CLIENTE, client_secret: secreto });

  const app = express();
  app.use(express.json());
  app.use("/api/pagos/reversiones", require("../routes/reversionRoutes"));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const url = `http://localhost:${servidor.address().port}/api/pagos/reversiones`;
  const pedir = async (ruta, opciones = {}) => {
    const r = await fetch(url + ruta, opciones);
    return { status: r.status, cuerpo: await r.json() };
  };
  const crear = (token) =>
    pedir("", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id_transaccion: id("RUTA"), ...BASE }),
    });

  try {
    assert.equal((await crear(null)).status, 401);
    assert.equal((await crear("token-falso")).status, 401);

    const creada = await crear(access_token); // usa la pasarela simulada real (sin fallos)
    assert.equal(creada.status, 201);
    assert.equal(creada.cuerpo.data.estado, "CONFIRMADA");
    assert.equal(creada.cuerpo.data.monto, 80);

    const repetida = await crear(access_token);
    assert.equal(repetida.status, 409);

    const una = await pedir(`/${creada.cuerpo.data.id}`);
    assert.equal(una.status, 200);
    assert.equal(una.cuerpo.data.id_transaccion, id("RUTA"));

    const lista = await pedir(`?id_transaccion=${id("RUTA")}`);
    assert.equal(lista.cuerpo.total, 1);

    const reintento = await pedir(`/${creada.cuerpo.data.id}/reintentar`, { method: "POST" });
    assert.equal(reintento.status, 409); // ya está CONFIRMADA
  } finally {
    servidor.close();
  }
});
