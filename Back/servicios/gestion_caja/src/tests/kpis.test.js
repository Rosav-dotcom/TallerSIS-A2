// TDSI-639/1130: tests de los KPIs del Tablero (pestañas "Caja" y "Devoluciones y soporte"):
// KPI-3, 4 y 7 con la BD real (filas propias en mayo de 2003, se borran al final) y KPI-9 y 10
// con Devoluciones, Gestion de pagos y Soporte reemplazados por un servidor falso con las mismas
// rutas. PA TDSI-646, 647 y 648. Las URLs se fijan antes de cargar los modulos (las leen al cargarse).
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const C1 = "CAJA-KPI-1";
const C2 = "CAJA-KPI-2";
const CAJERO_A = "KPI-CAJ-A";
const CAJERO_B = "KPI-CAJ-B";
const MAYO = "desde=2003-05-01&hasta=2003-05-31";
const en = (cuando) => `${cuando}-04`; // hora de Bolivia

// ---------- Devoluciones, Gestion de pagos y Soporte falsos ----------
const falso = {
  devoluciones: [],
  vendido: { [C1]: 1000, [C2]: 500 },
  tickets: [],
  caido: { devoluciones: false, soporte: false },
  pedidos: { devoluciones: [], pagos: [], soporte: [] },
};
const externo = express();
externo.get("/api/devoluciones/reportes", (req, res) => {
  falso.pedidos.devoluciones.push({ ...req.query });
  if (falso.caido.devoluciones) return res.status(500).json({ ok: false, mensaje: "caido" });
  res.json({ ok: true, data: { devoluciones: falso.devoluciones, notas_credito: [] } });
});
externo.get("/api/pagos/reporte-turno", (req, res) => {
  falso.pedidos.pagos.push(req.query);
  const total = falso.vendido[req.query.caja_id] || 0;
  res.json({
    ok: true,
    data: {
      totalGeneral: total, cantidadVentas: total ? 10 : 0, totalEfectivo: total, totalTarjeta: 0, totalQR: 0,
      operacionesPorMetodo: { Efectivo: total ? 10 : 0, Tarjeta: 0, QR: 0 },
    },
  });
});
externo.get("/api/soporte/tickets", (req, res) => {
  falso.pedidos.soporte.push({ query: { ...req.query }, authorization: req.headers.authorization });
  if (falso.caido.soporte) return res.status(503).json({ ok: false, mensaje: "caido" });
  const limite = Number(req.query.limite);
  const pagina = Number(req.query.pagina);
  res.json({
    ok: true,
    data: falso.tickets.slice((pagina - 1) * limite, pagina * limite),
    paginacion: { pagina, limite, total: falso.tickets.length, paginas: Math.ceil(falso.tickets.length / limite) },
  });
});

let servidorExterno, servidor, base, query, pool, kpiComun, kpisCaja;

async function limpiar() {
  await query(
    `DELETE FROM caja.diferencias_resolucion WHERE turno_id IN (SELECT id FROM caja.turnos WHERE caja_id = ANY($1))`,
    [[C1, C2]]
  );
  await query(`DELETE FROM caja.autorizaciones WHERE caja_id = ANY($1)`, [[C1, C2]]);
  await query(`DELETE FROM caja.turnos WHERE caja_id = ANY($1)`, [[C1, C2]]);
  await query(`DELETE FROM caja.cajas WHERE codigo = ANY($1)`, [[C1, C2]]);
}

let nTurno = 0;
async function turno({ caja = C1, cajero = CAJERO_A, nombre = "Ana Quispe", estado = "CERRADO", tipo = "CUADRA", cierre = "2003-05-10 12:00" }) {
  nTurno += 1;
  const { rows } = await query(
    `INSERT INTO caja.turnos (codigo, caja_id, cajero_id, cajero_nombre, estado, tipo_diferencia, abierto_en, cerrado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [`TK${String(Date.now()).slice(-8)}-${nTurno}`, caja, cajero, nombre, estado, tipo, en("2003-05-01 08:00"),
      estado === "CERRADO" ? en(cierre) : null]
  );
  return Number(rows[0].id);
}

async function autorizacion({ caja = C1, cajero = CAJERO_A, tipo = "APERTURA", estado = "APROBADA", solicitado, resuelto }) {
  await query(
    `INSERT INTO caja.autorizaciones (tipo, caja_id, cajero_id, estado, solicitado_en, resuelto_en)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tipo, caja, cajero, estado, en(solicitado), resuelto ? en(resuelto) : null]
  );
}

const diferencia = (turnoId, monto, tipo, estado) => query(
  `INSERT INTO caja.diferencias_resolucion (turno_id, monto, tipo, estado) VALUES ($1, $2, $3, $4)`,
  [turnoId, monto, tipo, estado]
);

const pedir = async (ruta, headers = {}) => {
  const r = await fetch(`${base}${ruta}`, { headers });
  return { status: r.status, cuerpo: await r.json() };
};
const kpi = async (ruta) => {
  const { status, cuerpo } = await pedir(ruta);
  assert.equal(status, 200, JSON.stringify(cuerpo));
  return cuerpo.data.kpi;
};

test.before(async () => {
  await new Promise((ok) => { servidorExterno = externo.listen(0, ok); });
  const url = `http://localhost:${servidorExterno.address().port}`;
  process.env.DEVOLUCIONES_URL = url;
  process.env.GESTION_PAGOS_URL = url;
  process.env.SOPORTE_URL = url;

  ({ query, pool } = require("../config/db"));
  kpiComun = require("../services/kpiComun");
  kpisCaja = require("../services/kpisCajaService");
  const { errorHandler } = require("../middlewares/errorHandler");
  await limpiar();
  await query(`INSERT INTO caja.cajas (codigo, nombre, estado) VALUES ($1, 'Caja KPI 1', 'ACTIVA'), ($2, 'Caja KPI 2', 'ACTIVA')`, [C1, C2]);

  const app = express();
  app.use(express.json());
  app.use("/api/kpis", require("../routes/kpisRoutes"));
  app.use(errorHandler);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/kpis`;
});

test.after(async () => {
  servidor.close();
  servidorExterno.close();
  await limpiar();
  await pool.end();
});

// ---------- filtros y semaforo ----------
test("filtros del tablero: periodo por defecto, fechas, caja inexistente y semaforo", async () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());
  const { cuerpo } = await pedir("/caja/exactitud-arqueo");
  assert.deepEqual(cuerpo.data.filtros, { desde: `${hoy.slice(0, 8)}01`, hasta: hoy, caja_id: null, cajero_id: null });

  const casos = [
    ["/caja?desde=2003-02-30&hasta=2003-03-01", 400, /'desde' debe ser una fecha valida/],
    ["/caja?desde=2003-05-31&hasta=2003-05-01", 400, /'desde' no puede ser mayor que 'hasta'/],
    ["/caja?desde=2002-01-01&hasta=2003-01-02", 400, /hasta 366 dias/],
    ["/caja?caja_id=CAJA-NO-EXISTE", 404, /La caja "CAJA-NO-EXISTE" no existe/],
    ["/devoluciones-soporte?caja_id=CAJA-NO-EXISTE", 404, /no existe/],
  ];
  for (const [ruta, status, mensaje] of casos) {
    const r = await pedir(ruta);
    assert.equal(r.status, status, ruta);
    assert.match(r.cuerpo.mensaje, mensaje, ruta);
  }
  assert.equal((await pedir("/caja?desde=2004-01-01&hasta=2004-12-31")).status, 200); // 366 dias (bisiesto)

  const { semaforoMayorEsMejor: mayor, semaforoMenorEsMejor: menor } = kpiComun;
  assert.deepEqual([95, 94.9, 85, 84.9, null].map((v) => mayor(v, { meta: 95, atencion: 85 }).estado),
    ["EN_META", "ATENCION", "ATENCION", "FUERA_DE_META", "SIN_DATOS"]);
  assert.deepEqual([3, 3.1, 10, 10.1].map((v) => menor(v, { meta: 3, atencion: 10 }).texto),
    ["En meta", "Atención", "Atención", "Fuera de meta"]);
});

// ---------- KPI-3 ----------
test("TDSI-646: la exactitud de arqueo coincide con los turnos cerrados del periodo que cuadran", async () => {
  await turno({ tipo: "CUADRA" });
  await turno({ tipo: "CUADRA" });
  await turno({ tipo: "FALTANTE" });
  await turno({ tipo: null }); // cerrado sin arqueo: cuenta como cerrado, no cuadra
  await turno({ cajero: CAJERO_B, nombre: "Beto Mamani", tipo: "CUADRA", cierre: "2003-05-31 23:30" }); // ultimo dia, 23:30 Bolivia
  await turno({ cajero: CAJERO_B, nombre: "Beto Mamani", tipo: "SOBRANTE", caja: C2 });
  await turno({ estado: "ABIERTO", tipo: null }); // abierto: no cuenta
  await turno({ tipo: "FALTANTE", cierre: "2003-06-01 00:00" }); // fuera del periodo
  await turno({ tipo: "FALTANTE", cierre: "2003-04-30 23:59" }); // fuera del periodo

  const k = await kpi(`/caja/exactitud-arqueo?${MAYO}`);
  assert.deepEqual([k.kpi, k.nombre, k.formula, k.unidad],
    ["KPI-3", "Exactitud de arqueo", "Turnos CERRADOS con tipo_diferencia = CUADRA ÷ Turnos CERRADOS × 100", "%"]);
  assert.deepEqual(k.datos, { cerrados: 6, cuadran: 3, faltantes: 1, sobrantes: 1, sin_arqueo: 1 });
  assert.equal(k.valor, 50); // 3 de 6
  assert.equal(k.semaforo.estado, "FUERA_DE_META");
  assert.equal(k.detalle, "1 turno con faltante");
  assert.deepEqual(k.por_cajero.map((c) => [c.cajero_nombre, c.cerrados, c.cuadran, c.porcentaje]),
    [["Ana Quispe", 4, 2, 50], ["Beto Mamani", 2, 1, 50]]);

  // filtros de caja y cajero
  const caja2 = await kpi(`/caja/exactitud-arqueo?${MAYO}&caja_id=${C2}`);
  assert.deepEqual([caja2.datos.cerrados, caja2.valor], [1, 0]);
  const beto = await kpi(`/caja/exactitud-arqueo?${MAYO}&cajero_id=${CAJERO_B}`);
  assert.deepEqual([beto.datos.cerrados, beto.datos.cuadran, beto.valor], [2, 1, 50]);
  const betoCaja1 = await kpi(`/caja/exactitud-arqueo?${MAYO}&caja_id=${C1}&cajero_id=${CAJERO_B}`);
  assert.deepEqual([betoCaja1.valor, betoCaja1.semaforo.estado], [100, "EN_META"]);
  const sinTurnos = await kpi("/caja/exactitud-arqueo?desde=2003-02-01&hasta=2003-02-28");
  assert.deepEqual([sinTurnos.valor, sinTurnos.semaforo.texto, sinTurnos.detalle], [null, "Sin datos", "Sin turnos cerrados en el periodo"]);
});

// ---------- KPI-4 ----------
test("TDSI-647: el tiempo de autorizacion se calcula como resuelto menos solicitado", async () => {
  await autorizacion({ solicitado: "2003-05-10 08:00:00", resuelto: "2003-05-10 08:02:00" }); // 2 min
  await autorizacion({ tipo: "CIERRE", estado: "RECHAZADA", solicitado: "2003-05-10 12:00:00", resuelto: "2003-05-10 12:07:30" }); // 7,5 min
  await autorizacion({ cajero: CAJERO_B, caja: C2, solicitado: "2003-05-20 09:00:00", resuelto: "2003-05-20 09:00:30" }); // 0,5 min
  await autorizacion({ estado: "PENDIENTE", solicitado: "2003-05-11 08:00:00" }); // pendiente: no cuenta
  await autorizacion({ solicitado: "2003-05-31 23:50:00", resuelto: "2003-06-01 00:30:00" }); // se resolvio en junio
  await autorizacion({ solicitado: "2003-04-30 23:55:00", resuelto: "2003-05-01 00:05:00" }); // 10 min, resuelta el 1 de mayo

  const k = await kpi(`/caja/tiempo-autorizacion?${MAYO}`);
  assert.deepEqual([k.kpi, k.formula, k.unidad], ["KPI-4", "Promedio(resuelto_en − solicitado_en) de solicitudes APROBADAS o RECHAZADAS", "min"]);
  assert.deepEqual(k.datos, { resueltas: 4, aprobadas: 3, rechazadas: 1, promedio_segundos: 300 }); // (120+450+30+600)/4
  assert.equal(k.valor, 5);
  assert.equal(k.semaforo.estado, "ATENCION");
  assert.equal(k.detalle, "4 solicitudes resueltas");
  assert.deepEqual(k.por_tipo.map((t) => [t.tipo, t.resueltas, t.promedio_minutos]), [["APERTURA", 3, 4.2], ["CIERRE", 1, 7.5]]);
  assert.deepEqual(k.por_mes.map((m) => [m.mes, m.resueltas, m.promedio_minutos]), [["2003-05", 4, 5]]);

  const dosMeses = await kpi("/caja/tiempo-autorizacion?desde=2003-05-01&hasta=2003-06-30");
  assert.deepEqual(dosMeses.por_mes.map((m) => [m.mes, m.resueltas, m.promedio_minutos, m.semaforo.estado]),
    [["2003-05", 4, 5, "ATENCION"], ["2003-06", 1, 40, "FUERA_DE_META"]]);

  const beto = await kpi(`/caja/tiempo-autorizacion?${MAYO}&cajero_id=${CAJERO_B}`);
  assert.deepEqual([beto.valor, beto.semaforo.estado, beto.detalle], [0.5, "EN_META", "1 solicitud resuelta"]);
  assert.equal((await kpi(`/caja/tiempo-autorizacion?${MAYO}&caja_id=${C2}`)).datos.resueltas, 1);
});

// ---------- KPI-7 ----------
test("TDSI-648: el monto de diferencias separa faltantes y sobrantes y muestra cuantas siguen pendientes", async () => {
  const t1 = await turno({ tipo: "FALTANTE", cierre: "2003-05-12 12:00" });
  const t2 = await turno({ tipo: "SOBRANTE", caja: C2, cajero: CAJERO_B, cierre: "2003-05-13 12:00" });
  const t3 = await turno({ tipo: "FALTANTE", cierre: "2003-05-14 12:00" });
  const fuera = await turno({ tipo: "FALTANTE", cierre: "2003-06-02 12:00" });
  await diferencia(t1, -80.5, "FALTANTE", "RESUELTA"); // el monto se guarda con signo
  await diferencia(t2, 70, "SOBRANTE", "PENDIENTE");
  await diferencia(t3, -40, "FALTANTE", "RESUELTA");
  await diferencia(fuera, -999, "FALTANTE", "PENDIENTE"); // fuera del periodo

  const k = await kpi(`/caja/diferencias?${MAYO}`);
  assert.deepEqual([k.kpi, k.nombre, k.unidad, k.valor], ["KPI-7", "Monto de diferencias de caja", "Bs", 120.5]);
  assert.deepEqual(k.datos, {
    faltante: 120.5, sobrante: 70, faltantes: 2, sobrantes: 1, registradas: 3, resueltas: 2, pendientes: 1,
    porcentaje_resueltas: 66.7, faltante_por_semana: 27.21, // 120,5 en 31 dias
  });
  assert.equal(k.detalle, "Sobrantes Bs 70,00 · 1 pendiente");
  assert.equal(k.semaforo.estado, "FUERA_DE_META"); // una diferencia sin resolver
  assert.deepEqual(k.por_caja, [
    { caja_id: C1, faltante: 120.5, sobrante: 0, registradas: 2, resueltas: 2, pendientes: 0 },
    { caja_id: C2, faltante: 0, sobrante: 70, registradas: 1, resueltas: 0, pendientes: 1 },
  ]);

  // sin pendientes: faltante por semana contra Bs 100 y Bs 300
  const soloCaja1 = await kpi(`/caja/diferencias?${MAYO}&caja_id=${C1}`);
  assert.deepEqual([soloCaja1.datos.pendientes, soloCaja1.semaforo.estado, soloCaja1.detalle], [0, "EN_META", "Sobrantes Bs 0,00 · 0 pendientes"]);
  const unaSemana = await kpi(`/caja/diferencias?desde=2003-05-12&hasta=2003-05-14&caja_id=${C1}`); // 120,5 en una semana
  assert.equal(unaSemana.semaforo.estado, "ATENCION");
  const { semaforoDiferencias } = kpisCaja;
  assert.equal(semaforoDiferencias({ faltante: 100, pendientes: 0, dias: 7 }).estado, "EN_META");
  assert.equal(semaforoDiferencias({ faltante: 300, pendientes: 0, dias: 7 }).estado, "ATENCION");
  assert.equal(semaforoDiferencias({ faltante: 300.01, pendientes: 0, dias: 7 }).estado, "FUERA_DE_META");
  assert.equal(semaforoDiferencias({ faltante: 0, pendientes: 1, dias: 7 }).estado, "FUERA_DE_META");

  const sinDiferencias = await kpi("/caja/diferencias?desde=2003-02-01&hasta=2003-02-28");
  assert.deepEqual([sinDiferencias.valor, sinDiferencias.datos.porcentaje_resueltas, sinDiferencias.semaforo.estado], [0, null, "EN_META"]);

  // la pestaña "Caja" trae los tres
  const { cuerpo } = await pedir(`/caja?${MAYO}`);
  assert.deepEqual(Object.keys(cuerpo.data.kpis), ["exactitud_arqueo", "tiempo_autorizacion", "diferencias_caja"]);
  assert.equal(cuerpo.data.kpis.diferencias_caja.valor, 120.5);
});

// ---------- KPI-9 ----------
test("KPI-9: la tasa de devoluciones cuenta solo devoluciones APROBADAS o PROCESADAS, por motivo", async () => {
  const dev = (codigo, estado, monto, motivo, tipo = "PARCIAL", caja = C1) =>
    ({ codigo, estado, monto_total: monto, motivo, tipo, caja_id: caja });
  falso.devoluciones = [
    dev("DEV-000001", "APROBADA", 10, "Producto vencido"),
    dev("DEV-000002", "PROCESADA", 15, "Producto vencido", "TOTAL"),
    dev("DEV-000003", "PROCESADA", 5, "Empaque dañado", "PARCIAL", C2),
    dev("DEV-000004", "PENDIENTE", 100, "Error de cobro"), // todavia no
    dev("DEV-000005", "RECHAZADA", 200, "Error de cobro"), // no devuelve dinero
    dev("DEV-000006", "APROBADA", 2.5, null),
  ];
  const k = await kpi(`/devoluciones-soporte/tasa-devoluciones?${MAYO}`);
  assert.deepEqual([k.kpi, k.nombre, k.unidad], ["KPI-9", "Tasa de devoluciones", "%"]);
  assert.equal(k.formula, "Σ monto devuelto (APROBADA o PROCESADA) ÷ Σ monto vendido × 100, desglosado por motivo");
  assert.deepEqual(k.datos, {
    devoluciones: 4, parciales: 3, totales: 1, monto_devuelto: 32.5, monto_vendido: 1500, no_cuentan: { pendientes: 1, rechazadas: 1 },
  });
  assert.equal(k.valor, 2.2); // 32,5 / 1500
  assert.equal(k.semaforo.estado, "ATENCION");
  assert.equal(k.detalle, "4 devoluciones");
  assert.deepEqual(k.monto_devuelto, { nombre: "Monto devuelto", valor: 32.5, unidad: "Bs", detalle: "3 parciales · 1 total" });
  assert.deepEqual(k.por_motivo.map((m) => [m.motivo, m.cantidad, m.monto]),
    [["Producto vencido", 2, 25], ["Empaque dañado", 1, 5], ["Sin motivo", 1, 2.5]]);
  assert.deepEqual(k.filtros_que_no_aplican, ["cajero_id"]);
  assert.deepEqual(falso.pedidos.devoluciones.at(-1), { desde: "2003-05-01", hasta: "2003-05-31" });

  // por caja: devoluciones y ventas de esa caja
  const caja2 = await kpi(`/devoluciones-soporte/tasa-devoluciones?${MAYO}&caja_id=${C2}`);
  assert.deepEqual([caja2.datos.monto_devuelto, caja2.datos.monto_vendido, caja2.valor, caja2.semaforo.estado], [5, 500, 1, "EN_META"]);

  // sin ventas no hay tasa
  falso.vendido = {};
  const sinVentas = await kpi(`/devoluciones-soporte/tasa-devoluciones?${MAYO}`);
  assert.deepEqual([sinVentas.valor, sinVentas.semaforo.estado], [null, "SIN_DATOS"]);
  falso.vendido = { [C1]: 1000, [C2]: 500 };

  // Devoluciones no responde: 502, sin inventar el dato
  falso.caido.devoluciones = true;
  const caido = await pedir(`/devoluciones-soporte/tasa-devoluciones?${MAYO}`);
  assert.equal(caido.status, 502);
  assert.equal(caido.cuerpo.mensaje, "Devoluciones no pudo responder el reporte del periodo.");
  falso.caido.devoluciones = false;
});

// ---------- KPI-10 ----------
test("KPI-10: el tiempo de resolucion de soporte se muestra por prioridad y marca en rojo las criticas de mas de 4 h", async () => {
  const base0 = new Date("2003-05-10T08:00:00-04:00").getTime();
  const ticket = (numero, prioridad, horas) => ({
    numero, prioridad, estado: horas === null ? "Abierto" : "Resuelto",
    creado_en: new Date(base0).toISOString(),
    resuelto_en: horas === null ? null : new Date(base0 + horas * 3600000).toISOString(),
  });
  falso.tickets = [
    ticket("INC-000001", "Critica", 2),
    ticket("INC-000002", "Critica", 7), // critica de mas de 4 h
    ticket("INC-000003", "Alta", 20),
    ticket("INC-000004", "Media", 30),
    ticket("INC-000005", "Baja", 60),
    ticket("INC-000006", "Media", null), // sin resolver: no cuenta
  ];
  // 100 tickets de relleno resueltos al instante, para obligar a leer dos paginas
  for (let i = 0; i < 100; i++) falso.tickets.push(ticket(`INC-9${String(i).padStart(5, "0")}`, "Baja", 0));
  falso.pedidos.soporte = [];

  const { status, cuerpo } = await pedir(`/devoluciones-soporte/resolucion-soporte?${MAYO}`, { Authorization: "Bearer token-admin" });
  assert.equal(status, 200);
  const k = cuerpo.data.kpi;
  assert.deepEqual([k.kpi, k.nombre, k.unidad, k.detalle], ["KPI-10", "Tiempo de resolución de soporte", "h", "Promedio general"]);
  assert.deepEqual(k.datos, { registrados: 106, resueltos: 105, sin_resolver: 1 });
  assert.equal(k.valor, 1.1); // (2+7+20+30+60+0*100)/105
  assert.equal(k.semaforo.estado, "FUERA_DE_META"); // la critica promedia 4,5 h
  assert.deepEqual(k.por_prioridad.map((p) => [p.nombre, p.resueltos, p.promedio_horas, p.semaforo.estado, p.en_rojo]), [
    ["Crítica", 2, 4.5, "FUERA_DE_META", true],
    ["Alta", 1, 20, "EN_META", false],
    ["Media", 1, 30, "ATENCION", false],
    ["Baja", 101, 0.6, "EN_META", false],
  ]);
  assert.deepEqual(k.tickets_criticos.mas_de_4h, [{ numero: "INC-000002", horas: 7 }]);
  assert.deepEqual([k.tickets_criticos.valor, k.tickets_criticos.detalle, k.tickets_criticos.semaforo.estado], [4.5, "Meta ≤ 4 h", "FUERA_DE_META"]);
  assert.deepEqual(k.filtros_que_no_aplican, ["caja_id", "cajero_id"]);
  // se reenvia el token del Administrador y se leen todas las paginas
  assert.deepEqual(falso.pedidos.soporte.map((p) => [p.query.pagina, p.query.limite, p.query.desde, p.query.hasta, p.authorization]), [
    ["1", "100", "2003-05-01", "2003-05-31", "Bearer token-admin"],
    ["2", "100", "2003-05-01", "2003-05-31", "Bearer token-admin"],
  ]);

  // criticas en meta: el general manda
  falso.tickets = [ticket("INC-000001", "Critica", 3), ticket("INC-000003", "Alta", 30)];
  const enMeta = await kpi(`/devoluciones-soporte/resolucion-soporte?${MAYO}`);
  assert.deepEqual([enMeta.valor, enMeta.semaforo.estado, enMeta.por_prioridad[0].en_rojo], [16.5, "EN_META", false]);
  falso.tickets = [];
  const vacio = await kpi(`/devoluciones-soporte/resolucion-soporte?${MAYO}`);
  assert.deepEqual([vacio.valor, vacio.semaforo.estado, vacio.por_prioridad[0].semaforo.estado], [null, "SIN_DATOS", "SIN_DATOS"]);
});

test("pestaña Devoluciones y soporte: si un servicio no responde, ese KPI queda en errores y el otro se muestra", async () => {
  falso.devoluciones = [{ codigo: "DEV-000001", estado: "APROBADA", monto_total: 15, motivo: "Producto vencido", tipo: "TOTAL", caja_id: C1 }];
  falso.tickets = [];
  let { cuerpo } = await pedir(`/devoluciones-soporte?${MAYO}`, { Authorization: "Bearer token-admin" });
  assert.deepEqual(cuerpo.data.errores, {});
  assert.equal(cuerpo.data.kpis.tasa_devoluciones.valor, 1);
  assert.equal(cuerpo.data.kpis.resolucion_soporte.kpi, "KPI-10");

  falso.caido.soporte = true;
  ({ cuerpo } = await pedir(`/devoluciones-soporte?${MAYO}`));
  assert.equal(cuerpo.data.kpis.resolucion_soporte, null);
  assert.deepEqual(cuerpo.data.errores, { resolucion_soporte: "Soporte no pudo responder los tickets del periodo." });
  assert.equal(cuerpo.data.kpis.tasa_devoluciones.valor, 1);
  assert.equal((await pedir(`/devoluciones-soporte/resolucion-soporte?${MAYO}`)).status, 502);
  falso.caido.soporte = false;
});

test("el Tablero de KPIs pide el token del Administrador", async () => {
  const { requireAdministrador } = require("../middlewares/requireAdministrador");
  const app = express();
  app.use("/api/kpis", requireAdministrador, require("../routes/kpisRoutes"));
  const s = await new Promise((ok) => { const x = app.listen(0, () => ok(x)); });
  const r = await fetch(`http://localhost:${s.address().port}/api/kpis/caja`);
  assert.equal(r.status, 401);
  assert.equal((await r.json()).mensaje, "Token de acceso requerido");
  s.close();
});
