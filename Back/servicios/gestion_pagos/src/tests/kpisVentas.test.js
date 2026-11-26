// TDSI-651 (TDSI-640): tests de las fórmulas de KPI-1, KPI-2, KPI-5, KPI-6 y KPI-8.
// 1) fórmulas puras (src/domain/kpisVentas.js): valores, semáforos y bordes de cada rango;
// 2) el servicio con un repositorio y unas metas simuladas: filtros, mes anterior, fallas;
// 3) contra la base de datos: un día armado a mano tiene que dar lo mismo que el cálculo manual (PA TDSI-662).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const k = require("../domain/kpisVentas");
const { crearKpisVentasService, validarFiltros, mesAnterior } = require("../services/kpisVentasService");
const { crearKpisVentasRoutes } = require("../routes/kpisVentasRoutes");
const { errorHandler } = require("../middlewares/errorHandler");
const { pool, query } = require("../config/db");

const sem = (tarjeta) => tarjeta.semaforo.texto;

// ---------------------------------------------------------------------------
// KPI-1 Ticket promedio
// ---------------------------------------------------------------------------

test("KPI-1: monto ÷ transacciones, comparado con el mes anterior", () => {
  const t = k.calcularTicketPromedio({
    actual: { cantidad: 4, monto: 420 },
    anterior: { cantidad: 2, monto: 200 },
    porDia: [{ fecha: "2026-11-02", cantidad: 3, monto: 300 }, { fecha: "2026-11-03", cantidad: 1, monto: 120 }],
  });
  assert.equal(t.kpi, "KPI-1");
  assert.equal(t.nombre, "Ticket promedio");
  assert.equal(t.formula, "Σ monto de transacciones Registradas ÷ N.º de transacciones Registradas");
  assert.equal(t.valor, 105);
  assert.equal(t.unidad, "Bs");
  assert.equal(t.datos.promedio_mes_anterior, 100);
  assert.equal(t.datos.variacion_porcentaje, 5);
  assert.equal(sem(t), "En meta");
  assert.equal(t.detalle, "▲ 5,0 % vs. mes ant.");
  assert.deepEqual(t.por_dia.map((d) => d.ticket_promedio), [100, 120]);
});

test("KPI-1 semáforo: baja hasta 10 % Atención, más de 10 % Fuera de meta, sin mes anterior Referencia", () => {
  const con = (monto) => k.calcularTicketPromedio({ actual: { cantidad: 1, monto }, anterior: { cantidad: 1, monto: 100 } });
  assert.equal(sem(con(100)), "En meta");
  assert.equal(sem(con(95)), "Atención");
  assert.equal(sem(con(90)), "Atención"); // baja exactamente 10 %
  assert.equal(sem(con(89.99)), "Atención"); // se muestra "▼ 10,0 %": el semáforo sigue al valor que se ve
  assert.equal(sem(con(89.9)), "Fuera de meta"); // ▼ 10,1 %
  assert.equal(con(80).detalle, "▼ 20,0 % vs. mes ant.");
  assert.equal(sem(k.calcularTicketPromedio({ actual: { cantidad: 2, monto: 50 }, anterior: { cantidad: 0, monto: 0 } })), "Referencia");
  const vacio = k.calcularTicketPromedio({ actual: { cantidad: 0, monto: 0 }, anterior: { cantidad: 3, monto: 30 } });
  assert.equal(vacio.valor, null);
  assert.equal(sem(vacio), "Sin datos");
});

// ---------------------------------------------------------------------------
// KPI-2 Tasa de anulación por cajero
// ---------------------------------------------------------------------------

test("KPI-2: anuladas ÷ emitidas × 100, en cantidad y en Bs (PA TDSI-663), por cajero de mayor a menor", () => {
  const t = k.calcularTasaAnulacion({
    porCajero: [
      { cajero_id: "ana", cajero: "Ana", emitidas: 100, anuladas: 1, monto_anulado: 50 },
      { cajero_id: "beto", cajero: "Beto", emitidas: 20, anuladas: 2, monto_anulado: 30.5 },
    ],
  });
  assert.equal(t.nombre, "Tasa de anulación por cajero");
  assert.equal(t.valor, 2.5);
  assert.equal(sem(t), "Atención");
  assert.deepEqual(t.datos, { emitidas: 120, anuladas: 3, monto_anulado: 80.5 });
  assert.equal(t.detalle, "3 de 120 facturas · Bs 80,50");
  assert.deepEqual(t.por_cajero.map((c) => [c.cajero_id, c.porcentaje, c.semaforo.texto]), [
    ["beto", 10, "Fuera de meta"],
    ["ana", 1, "En meta"],
  ]);
});

test("KPI-2 semáforo: ≤ 2 % En meta, ≤ 5 % Atención, > 5 % Fuera de meta; sin facturas Sin datos", () => {
  const tasa = (anuladas) => k.calcularTasaAnulacion({ porCajero: [{ cajero_id: "x", emitidas: 1000, anuladas, monto_anulado: anuladas }] });
  assert.equal(sem(tasa(20)), "En meta");
  assert.equal(sem(tasa(21)), "Atención");
  assert.equal(sem(tasa(50)), "Atención");
  assert.equal(sem(tasa(51)), "Fuera de meta");
  const vacio = k.calcularTasaAnulacion({ porCajero: [] });
  assert.equal(vacio.valor, null);
  assert.equal(sem(vacio), "Sin datos");
  assert.equal(vacio.detalle, "Sin facturas emitidas en el periodo");
});

// ---------------------------------------------------------------------------
// KPI-5 Mix de métodos de pago
// ---------------------------------------------------------------------------

test("KPI-5: el mix suma exactamente 100 % entre Efectivo, Tarjeta y QR, también con tercios", () => {
  for (const montos of [[1, 1, 1], [2, 1, 0], [703, 1009.8, 573], [0.01, 0.01, 99.98], [10, 0, 0]]) {
    const actual = k.METODOS.map((metodo, i) => ({ metodo, monto: montos[i], cantidad: 1 }));
    const t = k.calcularMixMetodos({ actual });
    const suma = Math.round(t.metodos.reduce((s, m) => s + m.porcentaje, 0) * 10) / 10;
    assert.equal(suma, 100, JSON.stringify(montos));
    assert.ok(t.metodos.every((m) => Math.round(m.porcentaje * 10) === m.porcentaje * 10), "1 decimal");
  }
});

test("KPI-5: la tarjeta 'Pago en efectivo' vale el % de Efectivo; Atención si un método cambia más de 10 puntos", () => {
  const actual = [{ metodo: "Efectivo", monto: 45, cantidad: 3 }, { metodo: "Tarjeta", monto: 25, cantidad: 1 }, { metodo: "QR", monto: 30, cantidad: 2 }];
  const igual = k.calcularMixMetodos({ actual, anterior: actual });
  assert.equal(igual.titulo_tarjeta, "Pago en efectivo");
  assert.equal(igual.valor, 45);
  assert.equal(igual.detalle, "QR 30,0 % · Tarjeta 25,0 %");
  assert.equal(sem(igual), "Referencia");

  const diezPuntos = k.calcularMixMetodos({ actual, anterior: [{ metodo: "Efectivo", monto: 55 }, { metodo: "Tarjeta", monto: 15 }, { metodo: "QR", monto: 30 }] });
  assert.equal(sem(diezPuntos), "Referencia"); // cambio de exactamente 10 puntos: todavía no
  const cambio = k.calcularMixMetodos({ actual, anterior: [{ metodo: "Efectivo", monto: 70 }, { metodo: "QR", monto: 30 }] });
  assert.equal(sem(cambio), "Atención");
  assert.deepEqual(cambio.metodos.map((m) => m.cambio_puntos), [-25, 25, 0]);
  assert.equal(cambio.datos.cambio_mayor_puntos, -25);

  const sinAnterior = k.calcularMixMetodos({ actual });
  assert.equal(sem(sinAnterior), "Referencia");
  assert.ok(sinAnterior.metodos.every((m) => m.cambio_puntos === null));
  assert.equal(sem(k.calcularMixMetodos({ actual: [] })), "Sin datos");
});

// ---------------------------------------------------------------------------
// KPI-6 Cumplimiento de meta de ventas
// ---------------------------------------------------------------------------

test("KPI-6: cada caja con el mismo % que Metas de venta; la tarjeta suma las cajas con meta", () => {
  const cajas = [
    { caja_id: "C1", caja_nombre: "Caja 1", vendido: 1200, meta: 1000, porcentaje: 120 },
    { caja_id: "C2", caja_nombre: "Caja 2", vendido: 450.5, meta: 500, porcentaje: 90.1 },
    { caja_id: "C3", caja_nombre: "Caja 3", vendido: 75, meta: "sin meta", porcentaje: "sin meta" },
  ];
  const t = k.calcularCumplimientoMeta({ fecha: "2026-11-25", cajas });
  assert.equal(t.nombre, "Cumplimiento de meta de ventas");
  assert.equal(t.valor, 110.0); // 1650.5 / 1500
  assert.equal(sem(t), "En meta");
  assert.equal(t.detalle, "Bs 1.650,50 / 1.500,00");
  assert.deepEqual(t.datos, { vendido: 1650.5, meta: 1500, cajas_con_meta: 2, cajas_sin_meta: 1 });
  assert.deepEqual(t.por_caja.map((c) => [c.caja_id, c.porcentaje, c.semaforo.texto]), [
    ["C1", 120, "En meta"],
    ["C2", 90.1, "Atención"],
    ["C3", null, "Sin datos"],
  ]);
});

test("KPI-6 semáforo: ≥ 100 % En meta, 80 – 99 % Atención, < 80 % Fuera de meta; sin metas o con error Sin datos", () => {
  const con = (vendido) => k.calcularCumplimientoMeta({ fecha: "2026-11-25", cajas: [{ caja_id: "C1", vendido, meta: 100 }] });
  assert.equal(sem(con(100)), "En meta");
  assert.equal(sem(con(99.9)), "Atención");
  assert.equal(sem(con(80)), "Atención");
  assert.equal(sem(con(79.9)), "Fuera de meta");
  assert.equal(con(50).por_caja[0].porcentaje, 50); // sin % de Gestión de caja, se calcula con 2 decimales

  const sinMetas = k.calcularCumplimientoMeta({ fecha: "2026-11-25", cajas: [{ caja_id: "C1", vendido: 10, meta: "sin meta" }] });
  assert.equal(sem(sinMetas), "Sin datos");
  assert.equal(sinMetas.detalle, "Ninguna caja tiene meta cargada");
  const caida = k.calcularCumplimientoMeta({ fecha: "2026-11-25", error: "Gestión de caja no responde" });
  assert.equal(sem(caida), "Sin datos");
  assert.equal(caida.error, "Gestión de caja no responde");
});

// ---------------------------------------------------------------------------
// KPI-8 Tasa de ventas canceladas antes del cobro
// ---------------------------------------------------------------------------

test("KPI-8: canceladas ÷ (cobradas + canceladas) × 100, con el motivo más frecuente", () => {
  const t = k.calcularTasaCanceladas({
    cobradas: 96,
    canceladas: [
      { motivo: "Fondos insuficientes", cantidad: 1, monto: 80 },
      { motivo: "El cliente desistió", cantidad: 3, monto: 45 },
    ],
  });
  assert.equal(t.nombre, "Tasa de ventas canceladas antes del cobro");
  assert.equal(t.valor, 4);
  assert.equal(sem(t), "Atención");
  assert.equal(t.detalle, "Motivo: El cliente desistió");
  assert.equal(t.datos.motivo_mas_frecuente, "El cliente desistió");
  assert.deepEqual(t.por_motivo.map((m) => [m.motivo, m.cantidad, m.porcentaje]), [
    ["El cliente desistió", 3, 75],
    ["Fondos insuficientes", 1, 25],
  ]);
  assert.equal(t.datos.monto_cancelado, 125);
});

test("KPI-8 semáforo: ≤ 3 % En meta, ≤ 6 % Atención, > 6 % Fuera de meta; en empate gana el de más Bs", () => {
  const tasa = (canc, cob) => k.calcularTasaCanceladas({ cobradas: cob, canceladas: [{ motivo: "Otro", cantidad: canc, monto: 1 }] });
  assert.equal(sem(tasa(3, 97)), "En meta");
  assert.equal(sem(tasa(6, 94)), "Atención");
  assert.equal(sem(tasa(7, 93)), "Fuera de meta");

  const sinCanceladas = k.calcularTasaCanceladas({ cobradas: 50, canceladas: [] });
  assert.equal(sinCanceladas.valor, 0);
  assert.equal(sem(sinCanceladas), "En meta");
  assert.equal(sinCanceladas.detalle, "Sin ventas canceladas");
  assert.equal(sem(k.calcularTasaCanceladas({ cobradas: 0, canceladas: [] })), "Sin datos");

  const empate = k.calcularTasaCanceladas({ cobradas: 10, canceladas: [{ motivo: "Otro", cantidad: 2, monto: 10 }, { motivo: "Error al cargar ítems", cantidad: 2, monto: 90 }] });
  assert.equal(empate.datos.motivo_mas_frecuente, "Error al cargar ítems");
});

// ---------------------------------------------------------------------------
// Servicio: filtros, mes anterior y fallas (repositorio y metas simulados)
// ---------------------------------------------------------------------------

function repoFalso(datos = {}) {
  const llamadas = [];
  const responder = (nombre, porDefecto) => async (filtros) => {
    llamadas.push([nombre, filtros]);
    const valor = datos[nombre];
    return typeof valor === "function" ? valor(filtros) : valor || porDefecto;
  };
  return {
    llamadas,
    ventasCobradasPorDia: responder("ventasCobradasPorDia", []),
    anulacionPorCajero: responder("anulacionPorCajero", []),
    montosPorMetodo: responder("montosPorMetodo", []),
    canceladasPorMotivo: responder("canceladasPorMotivo", []),
  };
}

test("filtros: por defecto el mes en curso hasta hoy; el mes anterior es el calendario anterior a 'desde'", () => {
  assert.deepEqual(validarFiltros({}, "2026-11-26"), { desde: "2026-11-01", hasta: "2026-11-26", dias: 26, cajaId: null, cajeroId: null });
  assert.equal(validarFiltros({ hasta: "2026-03-15" }, "2026-11-26").desde, "2026-03-01");
  assert.equal(validarFiltros({ desde: "2026-11-20" }, "2026-11-26").hasta, "2026-11-26");
  assert.deepEqual(mesAnterior("2026-01-10"), { desde: "2025-12-01", hasta: "2025-12-31" });
  assert.deepEqual(mesAnterior("2024-03-31"), { desde: "2024-02-01", hasta: "2024-02-29" });
  for (const q of [{ desde: "2026-02-30" }, { desde: "2026-11-20", hasta: "2026-11-01" }, { desde: "2025-01-01", hasta: "2026-01-02" }, { caja_id: ["a", "b"] }, { cajero_id: "x".repeat(61) }]) {
    assert.throws(() => validarFiltros(q, "2026-11-26"), (e) => e.status === 400, JSON.stringify(q).slice(0, 40));
  }
});

test("servicio: los filtros (periodo, caja, cajero) llegan a cada consulta y al mes anterior (PA TDSI-664)", async () => {
  const repo = repoFalso({
    ventasCobradasPorDia: (f) => (f.desde === "2026-11-01" ? [{ fecha: "2026-11-02", cantidad: 2, monto: 200 }] : [{ fecha: "2026-10-05", cantidad: 1, monto: 80 }]),
    canceladasPorMotivo: [{ motivo: "Otro", cantidad: 2, monto: 20 }],
  });
  const pedidas = [];
  const metas = { async obtenerMetasDelDia(fecha) { pedidas.push(fecha); return [{ caja_id: "C1", vendido: 90, meta: 100, porcentaje: 90 }, { caja_id: "C2", vendido: 10, meta: 10, porcentaje: 100 }]; } };
  const s = crearKpisVentasService({ repo, metas, hoy: () => "2026-11-26" });

  const r = await s.kpisVentas({ desde: "2026-11-01", hasta: "2026-11-15", caja_id: "C1", cajero_id: "ana" });
  assert.deepEqual(r.filtros, { desde: "2026-11-01", hasta: "2026-11-15", caja_id: "C1", cajero_id: "ana" });
  assert.deepEqual(r.mes_anterior, { desde: "2026-10-01", hasta: "2026-10-31" });
  for (const [, f] of repo.llamadas) {
    assert.equal(f.cajaId, "C1");
    assert.equal(f.cajeroId, "ana");
  }
  assert.ok(repo.llamadas.some(([n, f]) => n === "ventasCobradasPorDia" && f.desde === "2026-10-01" && f.hasta === "2026-10-31"));
  assert.ok(repo.llamadas.some(([n, f]) => n === "montosPorMetodo" && f.desde === "2026-10-01"));
  assert.deepEqual(pedidas, ["2026-11-15"]); // KPI-6 con el último día del periodo

  assert.equal(r.kpis.ticket_promedio.valor, 100);
  assert.equal(r.kpis.ticket_promedio.datos.promedio_mes_anterior, 80);
  assert.equal(r.kpis.cumplimiento_meta.por_caja.length, 1); // solo la caja filtrada
  assert.equal(r.kpis.cumplimiento_meta.valor, 90);
  assert.equal(r.kpis.tasa_canceladas.valor, 50); // 2 ÷ (2 + 2)
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /KPI-6/);
});

test("servicio: si Gestión de caja falla, solo KPI-6 queda Sin datos; fechas inválidas no consultan nada", async () => {
  const repo = repoFalso({ ventasCobradasPorDia: [{ fecha: "2026-11-02", cantidad: 1, monto: 50 }] });
  const metas = { async obtenerMetasDelDia() { throw new Error("No se pudo contactar a Gestión de caja"); } };
  const s = crearKpisVentasService({ repo, metas, hoy: () => "2026-11-26" });
  const r = await s.kpisVentas({});
  assert.equal(sem(r.kpis.cumplimiento_meta), "Sin datos");
  assert.match(r.kpis.cumplimiento_meta.error, /Gestión de caja/);
  assert.equal(r.kpis.ticket_promedio.valor, 50);
  assert.equal(r.avisos.length, 0);

  const antes = repo.llamadas.length;
  await assert.rejects(s.kpisVentas({ desde: "ayer" }), (e) => e.status === 400);
  assert.equal(repo.llamadas.length, antes);
});

test("ruta GET /api/kpis/ventas: 200 con las 5 tarjetas y 400 con un periodo inválido", async () => {
  const s = crearKpisVentasService({ repo: repoFalso(), metas: { obtenerMetasDelDia: async () => [] }, hoy: () => "2026-11-26" });
  const app = express();
  app.use("/api/kpis", crearKpisVentasRoutes(s));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const x = app.listen(0, () => ok(x)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/kpis/ventas`;
  try {
    const ok = await fetch(`${base}?desde=2026-11-01&hasta=2026-11-26`);
    assert.equal(ok.status, 200);
    const { data } = await ok.json();
    assert.deepEqual(Object.keys(data.kpis), ["ticket_promedio", "tasa_anulacion", "mix_metodos", "cumplimiento_meta", "tasa_canceladas"]);
    assert.deepEqual(Object.values(data.kpis).map((t) => t.kpi), ["KPI-1", "KPI-2", "KPI-5", "KPI-6", "KPI-8"]);
    assert.ok(Object.values(data.kpis).every((t) => t.formula && t.meta && t.semaforo.texto));
    assert.equal((await fetch(`${base}?desde=2026-12-01&hasta=2026-11-01`)).status, 400);
  } finally {
    servidor.close();
  }
});

// ---------------------------------------------------------------------------
// Contra la base de datos: un día armado a mano (PA TDSI-662)
// ---------------------------------------------------------------------------

const SUF = Date.now().toString(36).toUpperCase();
const CAJA = `KPI-${SUF}`;
const TX = (n) => `TKPI-${SUF}-${n}`;
const DIA = "2026-06-15"; // los dos días de prueba están lejos de los datos de demo
const DIA_MES_ANT = "2026-05-20";

async function venta(id, filas, { dia = DIA, hora = "10:00", cajero = `ana.${SUF}`, estado = "Registrado", estadoPago = "APROBADA" } = {}) {
  for (const [metodo, monto] of filas) {
    await query(
      `INSERT INTO pagos.transacciones (id_transaccion, metodo, monto, tipo_pago, estado, estado_pago, cajero_id, cajero, caja_id, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, ($9 || ' ' || $10)::timestamp AT TIME ZONE 'America/La_Paz')`,
      [id, metodo, monto, filas.length > 1 ? "Mixto" : "Simple", estado, estadoPago, cajero, CAJA, dia, hora]
    );
  }
}

test.after(async () => {
  await query(`DELETE FROM pagos.transacciones WHERE caja_id = $1`, [CAJA]);
  await query(`DELETE FROM pagos.ventas_canceladas WHERE caja_id = $1`, [CAJA]);
  await pool.end();
});

test("base de datos: el ticket promedio, la anulación, el mix y las canceladas coinciden con el cálculo manual del día", async () => {
  // Día 15: 3 cobradas (una mixta de 2 filas), 1 anulada, 1 rechazada, 1 cancelada antes del cobro
  await venta(TX(1), [["Efectivo", 100]]);
  await venta(TX(2), [["Efectivo", 30], ["QR", 70]], { hora: "11:30" }); // mixto: una venta de 100
  await venta(TX(3), [["Tarjeta", 55.5]], { hora: "23:59", cajero: `beto.${SUF}` }); // todavía es el día 15 en Bolivia
  await venta(TX(4), [["Efectivo", 40]], { estado: "Anulado" });
  await venta(TX(5), [["Tarjeta", 999]], { estadoPago: "RECHAZADA", cajero: `beto.${SUF}` });
  await venta(TX(6), [["Efectivo", 500]], { dia: "2026-06-16", hora: "00:01" }); // ya es otro día
  await query(
    `INSERT INTO pagos.ventas_canceladas (cajero_id, caja_id, items, total, motivo, creado_en)
     VALUES ($1, $2, '[]', 25, 'Fondos insuficientes', ($3 || ' 12:00')::timestamp AT TIME ZONE 'America/La_Paz')`,
    [`ana.${SUF}`, CAJA, DIA]
  );
  // Mes anterior: 2 ventas de 100 y 120 -> promedio 110
  await venta(TX(7), [["Efectivo", 100]], { dia: DIA_MES_ANT });
  await venta(TX(8), [["Efectivo", 120]], { dia: DIA_MES_ANT });

  const s = crearKpisVentasService({ metas: { obtenerMetasDelDia: async () => [] }, hoy: () => "2026-11-26" });
  const r = await s.kpisVentas({ desde: DIA, hasta: DIA, caja_id: CAJA });

  // Cálculo manual: (100 + 100 + 55.50) / 3 = 85.17
  const t = r.kpis.ticket_promedio;
  assert.equal(t.datos.transacciones, 3);
  assert.equal(t.datos.monto, 255.5);
  assert.equal(t.valor, 85.17);
  assert.equal(t.datos.promedio_mes_anterior, 110);
  assert.equal(t.datos.variacion_porcentaje, -22.6);
  assert.equal(sem(t), "Fuera de meta");
  assert.deepEqual(t.por_dia, [{ fecha: DIA, transacciones: 3, monto: 255.5, ticket_promedio: 85.17 }]);

  // Emitidas: ana 3 (2 cobradas + 1 anulada), beto 1 (la rechazada no emitió) -> 1 de 4
  const a = r.kpis.tasa_anulacion;
  assert.deepEqual(a.datos, { emitidas: 4, anuladas: 1, monto_anulado: 40 });
  assert.equal(a.valor, 25);
  assert.equal(a.detalle, "1 de 4 facturas · Bs 40,00");
  assert.deepEqual(a.por_cajero.map((c) => [c.cajero_id, c.emitidas, c.anuladas]), [[`ana.${SUF}`, 3, 1], [`beto.${SUF}`, 1, 0]]);

  // Mix: Efectivo 130, QR 70, Tarjeta 55.50 de 255.50 -> 50.9 + 27.4 + 21.7 = 100
  const m = r.kpis.mix_metodos;
  assert.deepEqual(m.metodos.map((x) => [x.metodo, x.monto, x.porcentaje]), [["Efectivo", 130, 50.9], ["Tarjeta", 55.5, 21.7], ["QR", 70, 27.4]]);
  assert.equal(m.datos.monto_total, 255.5);

  // Canceladas: 1 ÷ (3 + 1) = 25 %
  const c = r.kpis.tasa_canceladas;
  assert.equal(c.valor, 25);
  assert.equal(c.detalle, "Motivo: Fondos insuficientes");

  // Otro cajero: solo sus ventas
  const beto = await s.kpisVentas({ desde: DIA, hasta: DIA, caja_id: CAJA, cajero_id: `beto.${SUF}` });
  assert.equal(beto.kpis.ticket_promedio.valor, 55.5);
  assert.equal(beto.kpis.tasa_canceladas.datos.canceladas, 0);
});
