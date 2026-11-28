// TDSI-1096 (TDSI-67): tests del reporte de incidencias (repositorio simulado, sin base de datos).
// Cubren: rango sin datos, totales por estado y prioridad, tiempo promedio solo con resueltos,
// problemas frecuentes, el rango de fechas y la ruta.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { crearReportesService, resolverRango } = require("../src/services/reportesService");
const { construirFiltros } = require("../src/services/ticketsService");
const { calcularReporte, tiempoPromedioAtencion, problemasFrecuentes, duracionTexto } = require("../src/domain/reporteIncidentes");
const { crearSoporteRoutes } = require("../src/routes/soporteRoutes");
const { errorHandler } = require("../src/middlewares/errorHandler");

const HOY = "2026-11-26";
let n = 0;
/** Un incidente creado el 2026-11-20 a las 10:00 (UTC), resuelto "horas" después si se indica. */
function inc({ estado = "Abierto", prioridad = "Media", tipo = "Pagos", horas = null } = {}) {
  n += 1;
  const creado = Date.parse("2026-11-20T10:00:00Z");
  return {
    numero: `INC-${String(n).padStart(6, "0")}`,
    tipo,
    estado,
    prioridad,
    creado_en: new Date(creado),
    resuelto_en: horas === null ? null : new Date(creado + horas * 3600 * 1000),
  };
}

/** Repo falso: devuelve las filas dadas y guarda con qué condiciones se lo llamó. */
function repoFalso(filas = []) {
  return {
    llamadas: [],
    async incidentesDelRango(consulta) {
      this.llamadas.push(consulta);
      return filas;
    },
  };
}

const servicio = (filas) => {
  const repo = repoFalso(filas);
  return { repo, s: crearReportesService({ repo, hoy: () => HOY }) };
};

const cantidad = (lista, campo, valor) => lista.find((x) => x[campo] === valor).cantidad;

// ---------------------------------------------------------------------------
// Rango sin datos
// ---------------------------------------------------------------------------

test("rango sin datos: todo en 0, promedio vacío y sin problemas frecuentes", async () => {
  const { s } = servicio([]);
  const r = await s.reporteIncidentes({ desde: "2026-01-01", hasta: "2026-01-31" });
  assert.equal(r.total, 0);
  assert.deepEqual(r.rango, { desde: "2026-01-01", hasta: "2026-01-31", dias: 31 });
  assert.equal(r.por_estado.length, 6);
  assert.ok(r.por_estado.every((x) => x.cantidad === 0));
  assert.equal(r.por_prioridad.length, 4);
  assert.ok(r.por_prioridad.every((x) => x.cantidad === 0));
  assert.deepEqual(r.tiempo_promedio_atencion, {
    incidentes_resueltos: 0,
    promedio_minutos: null,
    promedio_horas: null,
    texto: "Sin incidentes resueltos en el rango",
  });
  assert.deepEqual(r.problemas_frecuentes, []);
});

// ---------------------------------------------------------------------------
// Totales por estado y prioridad (TDSI-211, PA TDSI-988)
// ---------------------------------------------------------------------------

test("totales por estado y prioridad: suman el total y traen todos los valores, también los que están en 0", () => {
  const filas = [
    inc({ estado: "Abierto", prioridad: "Alta" }),
    inc({ estado: "Abierto", prioridad: "Critica" }),
    inc({ estado: "En proceso", prioridad: "Alta" }),
    inc({ estado: "Resuelto", prioridad: "Baja", horas: 2 }),
    inc({ estado: "Escalado", prioridad: "Critica" }),
  ];
  const r = calcularReporte(filas);
  assert.equal(r.total, 5);
  assert.deepEqual(r.por_estado.map((x) => x.estado), ["Abierto", "En proceso", "Pendiente", "Resuelto", "Cerrado", "Escalado"]);
  assert.deepEqual(r.por_prioridad.map((x) => x.prioridad), ["Baja", "Media", "Alta", "Critica"]);
  assert.equal(cantidad(r.por_estado, "estado", "Abierto"), 2);
  assert.equal(cantidad(r.por_estado, "estado", "Pendiente"), 0);
  assert.equal(cantidad(r.por_estado, "estado", "Escalado"), 1);
  assert.equal(cantidad(r.por_prioridad, "prioridad", "Critica"), 2);
  assert.equal(cantidad(r.por_prioridad, "prioridad", "Media"), 0);
  assert.equal(r.por_estado.reduce((a, x) => a + x.cantidad, 0), r.total);
  assert.equal(r.por_prioridad.reduce((a, x) => a + x.cantidad, 0), r.total);
});

test("PA TDSI-988: el reporte filtra con las mismas condiciones de fecha que la bandeja de tickets", async () => {
  const { s, repo } = servicio([inc()]);
  await s.reporteIncidentes({ desde: "2026-11-01", hasta: "2026-11-15" });
  assert.deepEqual(repo.llamadas[0], construirFiltros({ desde: "2026-11-01", hasta: "2026-11-15" }));
});

// ---------------------------------------------------------------------------
// Tiempo promedio de atención (TDSI-1074, PA TDSI-989)
// ---------------------------------------------------------------------------

test("promedio: solo con incidentes resueltos (Resuelto y Cerrado), no con los que siguen abiertos", () => {
  const p = tiempoPromedioAtencion([
    inc({ estado: "Resuelto", horas: 2 }),
    inc({ estado: "Cerrado", horas: 4 }),
    inc({ estado: "Abierto" }),
    inc({ estado: "En proceso" }),
    inc({ estado: "Escalado" }),
  ]);
  assert.equal(p.incidentes_resueltos, 2);
  assert.equal(p.promedio_minutos, 180);
  assert.equal(p.promedio_horas, 3);
  assert.equal(p.texto, "3 h");
});

test("promedio: un reabierto (En proceso) no cuenta aunque tenga fecha de resuelto, ni una fecha imposible", () => {
  const raro = inc({ estado: "Resuelto", horas: 1 });
  raro.resuelto_en = new Date(raro.creado_en.getTime() - 60000); // resuelto antes de crearse
  const p = tiempoPromedioAtencion([inc({ estado: "En proceso", horas: 100 }), raro, inc({ estado: "Resuelto", horas: 1.5 })]);
  assert.equal(p.incidentes_resueltos, 1);
  assert.equal(p.promedio_minutos, 90);
  assert.equal(p.texto, "1 h 30 min");
});

test("promedio: también con fechas como texto (como llegan en JSON) y el texto en días", () => {
  const p = tiempoPromedioAtencion([
    { estado: "Resuelto", creado_en: "2026-11-20T10:00:00Z", resuelto_en: "2026-11-22T13:20:00Z" },
  ]);
  assert.equal(p.promedio_horas, 51.33);
  assert.equal(p.texto, "2 d 3 h 20 min");
  assert.equal(duracionTexto(0.4), "menos de 1 min");
  assert.equal(duracionTexto(45), "45 min");
});

// ---------------------------------------------------------------------------
// Problemas más frecuentes (TDSI-1095)
// ---------------------------------------------------------------------------

test("problemas frecuentes: de mayor a menor, con porcentaje y cuántos siguen sin resolver", () => {
  const filas = [
    inc({ tipo: "Pagos" }), inc({ tipo: "Pagos", estado: "Resuelto", horas: 1 }), inc({ tipo: "Pagos" }),
    inc({ tipo: "Acceso" }), inc({ tipo: "Acceso", estado: "Cerrado", horas: 1 }),
    inc({ tipo: "Facturacion" }),
  ];
  const top = problemasFrecuentes(filas);
  assert.deepEqual(top.map((x) => [x.posicion, x.tipo, x.cantidad, x.sin_resolver, x.porcentaje]), [
    [1, "Pagos", 3, 2, 50],
    [2, "Acceso", 2, 1, 33.3],
    [3, "Facturacion", 1, 1, 16.7],
  ]);
});

test("problemas frecuentes: como máximo 5; en empate primero el que tiene más sin resolver y luego por nombre", () => {
  const tipos = ["Otro", "Acceso", "Pagos", "Facturacion", "Error del sistema", "Inventario"];
  const filas = tipos.map((tipo) => inc({ tipo }));
  filas.push(inc({ tipo: "Otro", estado: "Resuelto", horas: 1 }));
  filas.push(inc({ tipo: "Pagos" }));
  const top = problemasFrecuentes(filas);
  assert.equal(top.length, 5);
  assert.deepEqual(top.map((x) => x.tipo), ["Pagos", "Otro", "Acceso", "Error del sistema", "Facturacion"]);
});

// ---------------------------------------------------------------------------
// Rango de fechas
// ---------------------------------------------------------------------------

test("rango por defecto: los últimos 30 días hasta hoy; con un solo extremo se completan 30 días", () => {
  assert.deepEqual(resolverRango({}, HOY), { desde: "2026-10-28", hasta: "2026-11-26", dias: 30 });
  assert.deepEqual(resolverRango({ desde: "2026-02-01" }, HOY), { desde: "2026-02-01", hasta: "2026-03-02", dias: 30 });
  assert.deepEqual(resolverRango({ hasta: "2026-03-31" }, HOY), { desde: "2026-03-02", hasta: "2026-03-31", dias: 30 });
  assert.deepEqual(resolverRango({ desde: HOY, hasta: HOY }, HOY), { desde: HOY, hasta: HOY, dias: 1 });
});

test("fechas inválidas -> 400 y no se consulta la base", async () => {
  const { s, repo } = servicio([]);
  const casos = [
    { desde: "26-11-2026" },
    { desde: "2026-02-30" },
    { hasta: "ayer" },
    { desde: ["2026-01-01", "2026-02-01"] },
    { desde: "2026-11-27", hasta: "2026-11-01" },
    { desde: "2025-01-01", hasta: "2026-01-02" }, // 367 días
  ];
  for (const consulta of casos) {
    await assert.rejects(s.reporteIncidentes(consulta), (e) => e.status === 400, JSON.stringify(consulta));
  }
  assert.equal(repo.llamadas.length, 0);
  assert.equal((await s.reporteIncidentes({ desde: "2025-01-01", hasta: "2026-01-01" })).rango.dias, 366);
});

// ---------------------------------------------------------------------------
// Ruta HTTP
// ---------------------------------------------------------------------------

test("ruta GET /api/soporte/reportes/incidentes: 200 con el reporte y 400 con fechas inválidas", async () => {
  const { s } = servicio([inc({ estado: "Resuelto", prioridad: "Alta", horas: 2 }), inc({ prioridad: "Alta" })]);
  const app = express();
  app.use("/api/soporte", crearSoporteRoutes({ reportesService: s }));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const x = app.listen(0, () => ok(x)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/soporte/reportes/incidentes`;
  try {
    const ok = await fetch(`${base}?desde=2026-11-01&hasta=2026-11-26`);
    assert.equal(ok.status, 200);
    const { data } = await ok.json();
    assert.equal(data.total, 2);
    assert.equal(cantidad(data.por_prioridad, "prioridad", "Alta"), 2);
    assert.equal(data.tiempo_promedio_atencion.promedio_horas, 2);
    assert.equal(data.problemas_frecuentes[0].tipo, "Pagos");

    const mal = await fetch(`${base}?desde=2026-13-01`);
    assert.equal(mal.status, 400);
    assert.match((await mal.json()).mensaje, /AAAA-MM-DD/);
  } finally {
    servidor.close();
  }
});
