// TDSI-82/1128: reporte de devoluciones y notas de credito -- filtros, sin resultados, totales y
// el Excel (PA TDSI-1061, 1062 y 1063). Datos propios en marzo de 2001 (ninguna devolucion real
// cae ahi); se borran al final y el correlativo DEV- vuelve a su valor.
const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const app = require("../app");
const { query, pool } = require("../config/db");
const devolucionesRepo = require("../data/devolucionesRepo");
const motivosRepo = require("../data/motivosRepo");
const { COLUMNAS_DEVOLUCIONES, COLUMNAS_NOTAS, FILA_ENCABEZADO } = require("../services/reportesExcelService");

const FACTURA = `T82-${String(Date.now()).slice(-8)}`;
const NC = `NC82${String(Date.now()).slice(-7)}`; // prefijo unico de las notas de credito de prueba
const MARZO = "desde=2001-03-01&hasta=2001-03-31";
const creados = [];
let servidor, base, correlativoInicial, m1, m2;
const dev = {};

/** Devolucion con fecha de solicitud fija (hora de Bolivia, -04:00). */
async function crear(clave, { fecha, motivo, opcion, monto, estado = null }) {
  const d = await devolucionesRepo.crear({
    factura_numero: FACTURA, fecha_venta: new Date("2001-02-20T12:00:00-04:00"), dentro_de_plazo: true, tipo: "PARCIAL",
    metodo_pago_original: "Efectivo", monto_total: monto, opcion_reembolso: opcion, motivo_id: motivo.id,
    creado_por: "ana.encargada@test.com", caja_id: "CAJA-01",
  }, [{ descripcion: "Aceite 900ml", cantidad: 1, precio_unitario: monto, subtotal: monto }]);
  creados.push(Number(d.codigo.slice(4)));
  await query("UPDATE devoluciones.devoluciones SET fecha_solicitud = $2 WHERE id = $1", [d.id, fecha]);
  if (estado === "RECHAZADA") {
    await devolucionesRepo.cambiarEstado(d.codigo, "RECHAZADA", { usuario: "sup", extra: { motivo_rechazo: "Fuera de política" } });
  } else if (estado) {
    await devolucionesRepo.cambiarEstado(d.codigo, estado, { usuario: "sup" });
  }
  dev[clave] = d;
  return d;
}
const notaCredito = (d, sufijo, monto, emitida, estado = "EMITIDA") => query(
  "INSERT INTO devoluciones.notas_credito (devolucion_id, numero, monto, estado, emitida_en) VALUES ($1, $2, $3, $4, $5)",
  [d.id, `${NC}${sufijo}`, monto, estado, emitida]
);

const obtener = async (q) => {
  const r = await fetch(`${base}?${q}`);
  return { status: r.status, cuerpo: await r.json() };
};
const codigos = (filas) => filas.map((f) => f.codigo);
const numeros = (filas) => filas.map((f) => f.numero);

async function descargar(q) {
  const r = await fetch(`${base}/excel?${q}`);
  if (!r.headers.get("content-type").includes("spreadsheetml")) return { status: r.status, cuerpo: await r.json(), r };
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(Buffer.from(await r.arrayBuffer()));
  return { status: r.status, libro, r };
}
/** Filas de datos de una hoja como objetos { key: valor } (hasta la primera fila vacia). */
function filasDe(hoja, columnas) {
  const filas = [];
  for (let n = FILA_ENCABEZADO + 1; ; n++) {
    const fila = hoja.getRow(n);
    if (!fila.getCell(1).value) break;
    filas.push(Object.fromEntries(columnas.map((c, i) => [c.key, fila.getCell(i + 1).value])));
  }
  return filas;
}
/** Etiqueta y monto de las filas del pie (despues de la fila en blanco). */
function pieDe(hoja, columnas, cantidadFilas) {
  const col = columnas.findIndex((c) => c.monto) + 1;
  const inicio = FILA_ENCABEZADO + Math.max(cantidadFilas, 1) + 2;
  return [0, 1].map((i) => [hoja.getRow(inicio + i).getCell(col - 1).value, hoja.getRow(inicio + i).getCell(col).value ?? null]);
}

test.before(async () => {
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  [m1, m2] = await motivosRepo.listarActivos();
  // A: 1 de marzo; B: 15 de marzo 23:30 en Bolivia (ya es 16 en UTC); C: 31 de marzo 23:59, rechazada;
  // D: 1 de abril 00:00 (fuera de marzo) pero con una nota ANULADA emitida el 31 de marzo.
  await crear("A", { fecha: "2001-03-01T10:00:00-04:00", motivo: m1, opcion: "VALE", monto: 100 });
  await crear("B", { fecha: "2001-03-15T23:30:00-04:00", motivo: m2, opcion: "EFECTIVO", monto: 50.25, estado: "APROBADA" });
  await crear("C", { fecha: "2001-03-31T23:59:00-04:00", motivo: m1, opcion: "REVERSION_TARJETA", monto: 30, estado: "RECHAZADA" });
  await crear("D", { fecha: "2001-04-01T00:00:00-04:00", motivo: m1, opcion: "VALE", monto: 10 });
  await notaCredito(dev.A, "A", 100, "2001-03-02T09:15:00-04:00");
  await notaCredito(dev.D, "D", 10, "2001-03-31T18:00:00-04:00", "ANULADA");
  await notaCredito(dev.B, "B", 50.25, "2001-04-05T10:00:00-04:00"); // emitida en abril: no entra en marzo
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones/reportes`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero = $1", [FACTURA]);
  if (creados.length) {
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2", [correlativoInicial, Math.max(...creados)]);
  }
  await pool.end();
});

// ---------- vista previa: filtros y totales ----------
test("TDSI-241: el rango toma dias de Bolivia y trae devoluciones y notas de credito con sus totales", async () => {
  const { status, cuerpo } = await obtener(MARZO);
  assert.equal(status, 200);
  const r = cuerpo.data;
  assert.deepEqual(codigos(r.devoluciones), [dev.A.codigo, dev.B.codigo, dev.C.codigo]); // D es de abril
  assert.deepEqual(numeros(r.notas_credito), [`${NC}A`, `${NC}D`]); // por fecha de emision; la de B es de abril
  assert.deepEqual(r.totales, {
    devoluciones: { cantidad: 3, monto: 180.25, rechazadas: 1, monto_sin_rechazadas: 150.25 },
    notas_credito: { cantidad: 2, emitidas: 1, anuladas: 1, monto_emitidas: 100 },
  });
  assert.equal(r.sin_resultados, false);
  assert.equal(r.mensaje, null);
  assert.deepEqual(r.filtros, { desde: "2001-03-01", hasta: "2001-03-31", sucursal: "Sucursal Central", estado: null, motivo: null, metodo_reembolso: null });

  const a = r.devoluciones[0];
  assert.deepEqual(
    [a.factura_numero, a.motivo, a.estado, a.metodo_reembolso, a.monto_total, a.sucursal, a.caja_id, a.nota_credito, a.registrado_por],
    [FACTURA, m1.nombre, "PENDIENTE", "Vale", 100, "Sucursal Central", "CAJA-01", `${NC}A`, "ana.encargada@test.com"]
  );
  assert.equal(r.devoluciones[2].motivo_rechazo, "Fuera de política");
  assert.deepEqual(r.notas_credito[1], {
    numero: `${NC}D`, fecha: new Date("2001-03-31T18:00:00-04:00").toISOString(), devolucion_codigo: dev.D.codigo,
    factura_numero: FACTURA, cliente_nit: null, motivo: m1.nombre, metodo_reembolso: "Vale", monto: 10, estado: "ANULADA",
    enviada_por_correo: false,
  });

  // un solo dia: el 15 de marzo de Bolivia incluye B aunque en UTC ya sea 16
  const dia = (await obtener("desde=2001-03-15&hasta=2001-03-15")).cuerpo.data;
  assert.deepEqual(codigos(dia.devoluciones), [dev.B.codigo]);
  assert.deepEqual(codigos((await obtener("desde=2001-03-16&hasta=2001-03-16")).cuerpo.data.devoluciones), []);
});

test("TDSI-241: filtros de motivo, metodo de reembolso, estado y sucursal", async () => {
  const conMotivo = (await obtener(`${MARZO}&motivo_id=${m1.id}`)).cuerpo.data;
  assert.deepEqual(codigos(conMotivo.devoluciones), [dev.A.codigo, dev.C.codigo]);
  assert.deepEqual(numeros(conMotivo.notas_credito), [`${NC}A`, `${NC}D`]);
  assert.deepEqual(conMotivo.filtros.motivo, { id: Number(m1.id), nombre: m1.nombre });

  const vale = (await obtener(`${MARZO}&metodo=vale`)).cuerpo.data;
  assert.deepEqual(codigos(vale.devoluciones), [dev.A.codigo]);
  assert.deepEqual(numeros(vale.notas_credito), [`${NC}A`, `${NC}D`]);
  assert.deepEqual(vale.filtros.metodo_reembolso, { codigo: "VALE", nombre: "Vale" });
  // por nombre tambien
  assert.deepEqual(codigos((await obtener(`${MARZO}&metodo=Reversión electrónica`)).cuerpo.data.devoluciones), [dev.C.codigo]);

  const rechazadas = (await obtener(`${MARZO}&estado=rechazada`)).cuerpo.data;
  assert.deepEqual(codigos(rechazadas.devoluciones), [dev.C.codigo]);
  assert.deepEqual(rechazadas.notas_credito, []);
  assert.deepEqual(rechazadas.totales.devoluciones, { cantidad: 1, monto: 30, rechazadas: 1, monto_sin_rechazadas: 0 });

  const combinado = (await obtener(`${MARZO}&motivo_id=${m2.id}&metodo=EFECTIVO&estado=APROBADA&sucursal=sucursal central`)).cuerpo.data;
  assert.deepEqual(codigos(combinado.devoluciones), [dev.B.codigo]);
  assert.equal(combinado.filtros.sucursal, "Sucursal Central");
});

test("TDSI-241: filtros invalidos responden 400 con el motivo", async () => {
  const casos = [
    ["", /^Elija el rango de fechas/],
    ["desde=2001-03-01", /^Elija el rango de fechas/],
    ["desde=2001-02-30&hasta=2001-03-01", /'desde' debe ser una fecha/],
    ["desde=2001-03-31&hasta=2001-03-01", /'desde' no puede ser posterior a 'hasta'/],
    ["desde=2023-01-01&hasta=2024-01-02", /hasta 366 días/],
    [`${MARZO}&sucursal=Norte`, /La sucursal debe ser una de: Sucursal Central/],
    [`${MARZO}&estado=ANULADA`, /El estado debe ser uno de/],
    [`${MARZO}&motivo_id=999999`, /El motivo elegido no existe/],
    [`${MARZO}&motivo_id=abc`, /El motivo elegido no existe/],
    [`${MARZO}&metodo=QR`, /El método de reembolso debe ser uno de: Efectivo, Reversión electrónica, Vale/],
  ];
  for (const [q, mensaje] of casos) {
    const { status, cuerpo } = await obtener(q);
    assert.equal(status, 400, q);
    assert.match(cuerpo.mensaje, mensaje, q);
  }
  assert.equal((await obtener("desde=2024-01-01&hasta=2024-12-31")).status, 200); // 366 dias (bisiesto) si
  // el Excel valida igual
  assert.equal((await fetch(`${base}/excel?desde=2001-03-01`)).status, 400);
});

test("TDSI-241: /filtros da las opciones de los selectores", async () => {
  const { data } = await (await fetch(`${base}/filtros`)).json();
  assert.deepEqual(data.sucursales, ["Sucursal Central"]);
  assert.deepEqual(data.estados, ["PENDIENTE", "APROBADA", "RECHAZADA", "PROCESADA"]);
  assert.deepEqual(data.metodos_reembolso.map((m) => m.codigo), ["EFECTIVO", "REVERSION_TARJETA", "VALE"]);
  assert.ok(data.motivos.some((m) => m.id === Number(m1.id) && m.nombre === m1.nombre && m.activo === true));
  assert.equal(data.max_dias, 366);
});

// ---------- Excel ----------
test("TDSI-1062: el Excel trae las hojas Devoluciones y Notas de credito con sus totales", async () => {
  const { status, libro, r } = await descargar(MARZO);
  assert.equal(status, 200);
  assert.equal(r.headers.get("content-disposition"), 'attachment; filename="reporte-devoluciones-2001-03-01_2001-03-31.xlsx"');
  assert.deepEqual(libro.worksheets.map((h) => h.name), ["Devoluciones", "Notas de crédito"]);

  const hojaDev = libro.getWorksheet("Devoluciones");
  assert.deepEqual(hojaDev.getRow(FILA_ENCABEZADO).values.slice(1), COLUMNAS_DEVOLUCIONES.map((c) => c.header));
  const filasDev = filasDe(hojaDev, COLUMNAS_DEVOLUCIONES);
  assert.deepEqual(filasDev.map((f) => f.codigo), [dev.A.codigo, dev.B.codigo, dev.C.codigo]);
  // fecha como fecha de Excel con la hora de Bolivia (10:00 del 1 de marzo), monto como numero
  assert.ok(filasDev[0].fecha instanceof Date);
  assert.equal(filasDev[0].fecha.toISOString(), "2001-03-01T10:00:00.000Z");
  assert.equal(filasDev[1].fecha.toISOString(), "2001-03-15T23:30:00.000Z");
  assert.equal(filasDev[1].monto_total, 50.25);
  assert.equal(hojaDev.getColumn(COLUMNAS_DEVOLUCIONES.findIndex((c) => c.key === "monto_total") + 1).numFmt, "#,##0.00");
  assert.deepEqual(pieDe(hojaDev, COLUMNAS_DEVOLUCIONES, 3), [["Total: 3 devoluciones", 180.25], ["Sin rechazadas: 2 devoluciones", 150.25]]);

  const hojaNc = libro.getWorksheet("Notas de crédito");
  const filasNc = filasDe(hojaNc, COLUMNAS_NOTAS);
  assert.deepEqual(filasNc.map((f) => [f.numero, f.devolucion_codigo, f.monto, f.estado, f.enviada_por_correo]), [
    [`${NC}A`, dev.A.codigo, 100, "EMITIDA", "No"],
    [`${NC}D`, dev.D.codigo, 10, "ANULADA", "No"],
  ]);
  assert.deepEqual(pieDe(hojaNc, COLUMNAS_NOTAS, 2), [["Total emitidas: 1 nota", 100], ["Anuladas: 1 nota (no suman)", null]]);
});

test("TDSI-1061: el Excel respeta los filtros elegidos (filas, totales y encabezado)", async () => {
  const q = `${MARZO}&motivo_id=${m1.id}&metodo=VALE`;
  const vista = (await obtener(q)).cuerpo.data;
  const { libro } = await descargar(q);
  const hojaDev = libro.getWorksheet("Devoluciones");
  const hojaNc = libro.getWorksheet("Notas de crédito");

  // mismas filas que la vista previa
  assert.deepEqual(filasDe(hojaDev, COLUMNAS_DEVOLUCIONES).map((f) => f.codigo), codigos(vista.devoluciones));
  assert.deepEqual(filasDe(hojaDev, COLUMNAS_DEVOLUCIONES).map((f) => f.codigo), [dev.A.codigo]);
  assert.deepEqual(filasDe(hojaNc, COLUMNAS_NOTAS).map((f) => f.numero), numeros(vista.notas_credito));
  assert.deepEqual(pieDe(hojaDev, COLUMNAS_DEVOLUCIONES, 1), [["Total: 1 devolución", 100], ["Sin rechazadas: 1 devolución", 100]]);

  for (const hoja of [hojaDev, hojaNc]) {
    assert.match(hoja.getCell("A1").value, /· Sucursal Central$/);
    assert.equal(hoja.getCell("A2").value, "Periodo: 01/03/2001 al 31/03/2001");
    assert.equal(hoja.getCell("A3").value, `Filtros: Estado: Todos · Motivo: ${m1.nombre} · Método de reembolso: Vale`);
  }
});

test("TDSI-1063: sin resultados avisa y no descarga un archivo vacio", async () => {
  for (const q of ["desde=2001-02-01&hasta=2001-02-28", `${MARZO}&estado=PROCESADA`, `${MARZO}&motivo_id=${m2.id}&metodo=VALE`]) {
    const { status, cuerpo, r, libro } = await descargar(q);
    assert.equal(status, 404, q);
    assert.equal(libro, undefined);
    assert.equal(r.headers.get("content-disposition"), null);
    assert.equal(cuerpo.ok, false);
    assert.equal(cuerpo.mensaje, "Sin resultados: no hay devoluciones ni notas de crédito con los filtros elegidos.");
    assert.equal(cuerpo.detalle.sin_resultados, true);

    const vista = (await obtener(q)).cuerpo.data;
    assert.deepEqual([vista.sin_resultados, vista.mensaje, vista.devoluciones, vista.notas_credito],
      [true, cuerpo.mensaje, [], []]);
  }

  // con solo notas de credito (ninguna devolucion) si se exporta: la hoja vacia lo dice
  const soloNotas = `desde=2001-03-31&hasta=2001-03-31&metodo=VALE`;
  const { status, libro } = await descargar(soloNotas);
  assert.equal(status, 200);
  assert.equal(libro.getWorksheet("Devoluciones").getCell(`A${FILA_ENCABEZADO + 1}`).value, "Sin devoluciones para estos filtros.");
  assert.deepEqual(filasDe(libro.getWorksheet("Notas de crédito"), COLUMNAS_NOTAS).map((f) => f.numero), [`${NC}D`]);
});
