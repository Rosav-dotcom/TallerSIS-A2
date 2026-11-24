// TDSI-78/1118: rechazo de una devolucion -- sin motivo (PA TDSI-1048), RECHAZADA con su motivo
// (PA TDSI-1049), ya procesada (TDSI-1116) y sin reembolso ni aviso a Inventario (PA TDSI-1050).
// Usa la BD real; borra lo que crea y devuelve el correlativo DEV- a su valor.
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { query, pool } = require("../config/db");
const devolucionesRepo = require("../data/devolucionesRepo");
const { errorHandler } = require("../middlewares/errorHandler");

const SUF = String(Date.now()).slice(-8);
const FACTURA = `T78-${SUF}`;
const creados = [];
let servidor, base, correlativoInicial;

async function crear(estado = null) {
  const d = await devolucionesRepo.crear({
    factura_numero: FACTURA, fecha_venta: new Date(), dentro_de_plazo: true, tipo: "PARCIAL",
    metodo_pago_original: "Efectivo", monto_total: 25, opcion_reembolso: "VALE", creado_por: "ana@test.com",
  }, [{ descripcion: "Aceite", cantidad: 1, precio_unitario: 25, subtotal: 25 }]);
  creados.push(Number(d.codigo.slice(4)));
  if (estado) await devolucionesRepo.cambiarEstado(d.codigo, estado, { usuario: "sup@test.com" });
  return d;
}

const rechazar = async (codigo, cuerpo) => {
  const r = await fetch(`${base}/${codigo}/rechazo`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json() };
};
const pedir = async (ruta) => (await (await fetch(`${base}${ruta}`)).json()).data;
const estadoDe = async (id) => (await query("SELECT estado, motivo_rechazo FROM devoluciones.devoluciones WHERE id = $1", [id])).rows[0];

test.before(async () => {
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero = $1", [FACTURA]);
  if (creados.length) {
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2",
      [correlativoInicial, Math.max(...creados)]);
  }
  await pool.end();
});

test("TDSI-1048: sin motivo no se puede rechazar (y no cambia nada)", async () => {
  const d = await crear();
  for (const motivo of [undefined, null, "", "    ", 5]) {
    const r = await rechazar(d.codigo, { motivo, usuario: "ana@test.com" });
    assert.equal(r.status, 400, String(motivo));
    assert.equal(r.cuerpo.mensaje, "Indique el motivo del rechazo.");
  }
  assert.deepEqual(await estadoDe(d.id), { estado: "PENDIENTE", motivo_rechazo: null });
  assert.equal((await pedir(`/${d.codigo}/historial`)).historial.length, 1);
});

test("TDSI-233: motivo de hasta 300 caracteres y usuario obligatorio", async () => {
  const d = await crear();
  const largo = await rechazar(d.codigo, { motivo: "x".repeat(301), usuario: "ana@test.com" });
  assert.equal(largo.status, 400);
  assert.equal(largo.cuerpo.mensaje, "El motivo del rechazo no puede tener más de 300 caracteres.");
  const sinUsuario = await rechazar(d.codigo, { motivo: "No corresponde" });
  assert.equal(sinUsuario.status, 400);
  assert.match(sinUsuario.cuerpo.mensaje, /^Indique quién rechaza la devolución/);
  assert.equal((await estadoDe(d.id)).estado, "PENDIENTE");

  const justo = await rechazar(d.codigo, { motivo: `  ${"ñ".repeat(300)}  `, usuario: "ana@test.com" });
  assert.equal(justo.status, 200);
  assert.equal(justo.cuerpo.data.motivo_rechazo, "ñ".repeat(300));
});

test("TDSI-1049: la devolucion rechazada se muestra RECHAZADA con su motivo (detalle, lista e historial)", async () => {
  const d = await crear();
  const { status, cuerpo } = await rechazar(d.codigo.toLowerCase(), { motivo: "  El producto fue usado  ", usuario: "ana.encargada@test.com" });
  assert.equal(status, 200);
  assert.equal(cuerpo.mensaje, `Devolución ${d.codigo} rechazada.`);
  assert.equal(cuerpo.data.estado, "RECHAZADA");
  assert.equal(cuerpo.data.motivo_rechazo, "El producto fue usado");
  assert.equal(cuerpo.data.rechazo.motivo, "El producto fue usado");
  assert.equal(cuerpo.data.rechazo.usuario, "ana.encargada@test.com");
  assert.ok(Math.abs(Date.parse(cuerpo.data.rechazo.fecha) - Date.now()) < 60000);

  assert.deepEqual(await pedir(`/${d.codigo}`), cuerpo.data); // guardado
  const fila = (await pedir(`?codigo=${d.codigo}`))[0];
  assert.deepEqual([fila.estado, fila.motivo_rechazo], ["RECHAZADA", "El producto fue usado"]);
  assert.ok((await pedir("?estado=RECHAZADA")).some((x) => x.codigo === d.codigo));

  // TDSI-1117: el historial lo tiene con usuario, hora y motivo
  const ultimo = (await pedir(`/${d.codigo}/historial`)).historial.at(-1);
  assert.deepEqual([ultimo.estado_anterior, ultimo.estado_nuevo, ultimo.usuario, ultimo.comentario],
    ["PENDIENTE", "RECHAZADA", "ana.encargada@test.com", "El producto fue usado"]);
  assert.equal(ultimo.fecha, cuerpo.data.rechazo.fecha);

  // una devolucion sin rechazar no trae el bloque
  assert.equal((await pedir(`/${(await crear()).codigo}`)).rechazo, null);
});

test("TDSI-233: se rechaza una APROBADA; una ya RECHAZADA no se vuelve a rechazar", async () => {
  const d = await crear("APROBADA");
  assert.equal((await rechazar(d.codigo, { motivo: "Revision posterior", usuario: "ana@test.com" })).status, 200);
  const otra = await rechazar(d.codigo, { motivo: "Otra vez", usuario: "ana@test.com" });
  assert.equal(otra.status, 409);
  assert.match(otra.cuerpo.mensaje, /está RECHAZADA/);
  assert.equal((await estadoDe(d.id)).motivo_rechazo, "Revision posterior");
});

test("TDSI-1116: una devolucion ya procesada no se puede rechazar", async () => {
  const d = await crear("PROCESADA");
  const r = await rechazar(d.codigo, { motivo: "Tarde", usuario: "ana@test.com" });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.mensaje, "No se puede rechazar una devolución ya procesada: el reembolso ya se emitió.");
  assert.equal((await estadoDe(d.id)).estado, "PROCESADA");
});

test("TDSI-1116: con reembolso emitido o en curso, o nota de credito emitida, no se rechaza", async () => {
  for (const estado of ["PENDIENTE", "PROCESADO"]) {
    const d = await crear("APROBADA");
    await query("INSERT INTO devoluciones.reembolsos (devolucion_id, tipo, monto, estado) VALUES ($1, 'VALE', 25, $2)", [d.id, estado]);
    const r = await rechazar(d.codigo, { motivo: "No procede", usuario: "ana@test.com" });
    assert.equal(r.status, 409, estado);
    assert.equal(r.cuerpo.mensaje, "No se puede rechazar: la devolución ya tiene un reembolso emitido o en curso.");
    assert.equal((await estadoDe(d.id)).estado, "APROBADA");
  }
  const conNota = await crear("APROBADA");
  await query("INSERT INTO devoluciones.notas_credito (devolucion_id, numero, monto) VALUES ($1, $2, 25)", [conNota.id, `NC-${SUF}-1`]);
  const r = await rechazar(conNota.codigo, { motivo: "No procede", usuario: "ana@test.com" });
  assert.equal(r.status, 409);
  assert.equal(r.cuerpo.mensaje, "No se puede rechazar: la devolución ya tiene una nota de crédito emitida.");

  // un reembolso que fallo o una nota anulada no impiden rechazar
  const fallido = await crear("APROBADA");
  await query("INSERT INTO devoluciones.reembolsos (devolucion_id, tipo, monto, estado) VALUES ($1, 'VALE', 25, 'ERROR')", [fallido.id]);
  await query("INSERT INTO devoluciones.notas_credito (devolucion_id, numero, monto, estado) VALUES ($1, $2, 25, 'ANULADA')", [fallido.id, `NC-${SUF}-2`]);
  assert.equal((await rechazar(fallido.codigo, { motivo: "No procede", usuario: "ana@test.com" })).status, 200);
});

test("TDSI-1050: una devolucion rechazada no genera reembolso, nota de credito ni aviso a Inventario", async () => {
  const d = await crear();
  assert.equal((await rechazar(d.codigo, { motivo: "No procede", usuario: "ana@test.com" })).status, 200);
  for (const [tabla, sql] of [
    ["reembolsos", "INSERT INTO devoluciones.reembolsos (devolucion_id, tipo, monto) VALUES ($1, 'VALE', 25)"],
    ["notas_credito", `INSERT INTO devoluciones.notas_credito (devolucion_id, numero, monto) VALUES ($1, 'NC-${SUF}-3', 25)`],
    ["notificaciones_inventario", "INSERT INTO devoluciones.notificaciones_inventario (devolucion_id) VALUES ($1)"],
  ]) {
    await assert.rejects(() => query(sql, [d.id]), (e) => e.code === "DV003" && e.message.includes(tabla), tabla);
  }
  const { rows } = await query(
    `SELECT (SELECT count(*) FROM devoluciones.reembolsos WHERE devolucion_id = $1)::int
          + (SELECT count(*) FROM devoluciones.notas_credito WHERE devolucion_id = $1)::int
          + (SELECT count(*) FROM devoluciones.notificaciones_inventario WHERE devolucion_id = $1)::int AS n`, [d.id]
  );
  assert.equal(rows[0].n, 0);

  let respuesta;
  const res = { status(s) { respuesta = { s }; return this; }, json(b) { respuesta.b = b; } };
  errorHandler(Object.assign(new Error("x"), { code: "DV003" }), {}, res);
  assert.equal(respuesta.s, 409);
  assert.equal(respuesta.b.mensaje, "La devolución está RECHAZADA: no genera reembolso, nota de crédito ni aviso a Inventario.");

  // una devolucion que no esta rechazada si puede tenerlos
  const ok = await crear("APROBADA");
  await query("INSERT INTO devoluciones.notificaciones_inventario (devolucion_id) VALUES ($1)", [ok.id]);
});

test("TDSI-233: dos rechazos al mismo tiempo -> uno se hace, el otro 409; codigo inexistente 404", async () => {
  const d = await crear();
  const [a, b] = await Promise.all([
    rechazar(d.codigo, { motivo: "Motivo A", usuario: "a@test.com" }),
    rechazar(d.codigo, { motivo: "Motivo B", usuario: "b@test.com" }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  const rechazos = (await pedir(`/${d.codigo}/historial`)).historial.filter((h) => h.estado_nuevo === "RECHAZADA");
  assert.equal(rechazos.length, 1);

  const r = await rechazar("DEV-9999999999", { motivo: "x", usuario: "a" });
  assert.equal(r.status, 404);
  assert.equal(r.cuerpo.mensaje, "Devolución no encontrada");
  assert.equal((await rechazar("no-es-codigo", { motivo: "x", usuario: "a" })).status, 404);
});
