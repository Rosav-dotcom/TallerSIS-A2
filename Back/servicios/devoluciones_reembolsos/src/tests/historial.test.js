// TDSI-81/1125: historial inmutable de cada devolucion -- UPDATE y DELETE rechazados
// (PA TDSI-1059), cada cambio con usuario y hora (PA TDSI-1058) y en orden cronologico
// (PA TDSI-1060). Usa la BD real; borra las devoluciones que crea (su historial se va con
// ellas) y devuelve el correlativo DEV- a su valor si nadie mas registro una.
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");
const { query, pool } = require("../config/db");
const devolucionesRepo = require("../data/devolucionesRepo");
const { errorHandler } = require("../middlewares/errorHandler");

const FACTURA = `T81-${String(Date.now()).slice(-8)}`;
let servidor, base, correlativoInicial;
const creados = []; // numeros DEV- creados (una prueba borra su devolucion: no alcanza con los que quedan)

async function crear(creado_por = "encargado@test.com") {
  const d = await devolucionesRepo.crear({
    factura_numero: FACTURA, fecha_venta: new Date(), dentro_de_plazo: true, tipo: "PARCIAL",
    metodo_pago_original: "Efectivo", monto_total: 10, opcion_reembolso: "VALE", creado_por,
  }, [{ descripcion: "Aceite", cantidad: 1, precio_unitario: 10, subtotal: 10 }]);
  creados.push(Number(d.codigo.slice(4)));
  return d;
}

const pedir = async (ruta, opciones) => {
  const r = await fetch(`${base}${ruta}`, opciones);
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
};
const historial = async (codigo) => (await pedir(`/${codigo}/historial`)).cuerpo.data.historial;
const filasHistorial = (id) => query("SELECT * FROM devoluciones.historial_estados WHERE devolucion_id = $1 ORDER BY id", [id]);

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

test("TDSI-1058: el registro y cada cambio de estado aparecen con usuario y hora", async () => {
  const antes = Date.now();
  const d = await crear("ana.encargada@test.com");
  await devolucionesRepo.cambiarEstado(d.codigo, "APROBADA", { usuario: "sup.carlos@test.com", comentario: "Autorizada por el supervisor" });
  await devolucionesRepo.cambiarEstado(d.codigo, "PROCESADA", { usuario: "ana.encargada@test.com" });

  const { status, cuerpo } = await pedir(`/${d.codigo}/historial`);
  assert.equal(status, 200);
  assert.equal(cuerpo.data.codigo, d.codigo);
  assert.equal(cuerpo.data.estado, "PROCESADA");
  assert.deepEqual(cuerpo.data.historial.map((h) => [h.estado_anterior, h.estado_nuevo, h.usuario, h.comentario]), [
    [null, "PENDIENTE", "ana.encargada@test.com", "Devolución registrada"],
    ["PENDIENTE", "APROBADA", "sup.carlos@test.com", "Autorizada por el supervisor"],
    ["APROBADA", "PROCESADA", "ana.encargada@test.com", null],
  ]);
  for (const h of cuerpo.data.historial) {
    assert.ok(h.usuario, "cada punto tiene usuario");
    const hora = Date.parse(h.fecha);
    assert.ok(hora >= antes - 5000 && hora <= Date.now() + 5000, `hora valida: ${h.fecha}`);
  }
});

test("TDSI-1058: un rechazo sin comentario guarda el motivo del rechazo", async () => {
  const d = await crear();
  await devolucionesRepo.cambiarEstado(d.codigo, "RECHAZADA", {
    usuario: "ana.encargada@test.com", extra: { motivo_rechazo: "El producto no corresponde a la factura" },
  });
  const ultimo = (await historial(d.codigo)).at(-1);
  assert.deepEqual([ultimo.estado_nuevo, ultimo.comentario], ["RECHAZADA", "El producto no corresponde a la factura"]);
  assert.equal((await pedir(`/${d.codigo}`)).cuerpo.data.motivo_rechazo, "El producto no corresponde a la factura");
});

test("TDSI-1057: un cambio hecho a mano en la BD tambien queda (con el usuario de la BD)", async () => {
  const d = await crear();
  await query("UPDATE devoluciones.devoluciones SET estado = 'APROBADA' WHERE id = $1", [d.id]);
  const ultimo = (await historial(d.codigo)).at(-1);
  assert.equal(ultimo.estado_nuevo, "APROBADA");
  const { rows } = await query("SELECT session_user AS u");
  assert.equal(ultimo.usuario, rows[0].u);
  // guardar el mismo estado (o cambiar otra columna) no agrega nada
  await query("UPDATE devoluciones.devoluciones SET estado = 'APROBADA', observaciones = 'x' WHERE id = $1", [d.id]);
  assert.equal((await historial(d.codigo)).length, 2);
});

test("TDSI-1060: la linea de tiempo esta en orden cronologico", async () => {
  const d = await crear();
  for (const [estado, usuario] of [["APROBADA", "a"], ["RECHAZADA", "b"], ["PENDIENTE", "c"], ["APROBADA", "d"], ["PROCESADA", "e"]]) {
    await devolucionesRepo.cambiarEstado(d.codigo, estado, { usuario });
  }
  const h = await historial(d.codigo);
  assert.deepEqual(h.map((x) => x.usuario), ["encargado@test.com", "a", "b", "c", "d", "e"]);
  const horas = h.map((x) => Date.parse(x.fecha));
  for (let i = 1; i < horas.length; i++) assert.ok(horas[i] > horas[i - 1], `hora ${i} posterior a la ${i - 1}`);
  // cada punto empieza donde termino el anterior
  for (let i = 1; i < h.length; i++) assert.equal(h[i].estado_anterior, h[i - 1].estado_nuevo);
});

test("TDSI-1059: el historial no se puede editar (UPDATE rechazado)", async () => {
  const d = await crear();
  for (const sql of [
    "UPDATE devoluciones.historial_estados SET cambiado_por = 'otro' WHERE devolucion_id = $1",
    "UPDATE devoluciones.historial_estados SET cambiado_en = now() - interval '1 day' WHERE devolucion_id = $1",
    "UPDATE devoluciones.historial_estados SET estado_nuevo = 'PROCESADA' WHERE devolucion_id = $1",
  ]) {
    await assert.rejects(() => query(sql, [d.id]), (e) => e.code === "DV002" && /no se puede editar ni borrar \(UPDATE\)/.test(e.message), sql);
  }
  const { rows } = await filasHistorial(d.id);
  assert.deepEqual(rows.map((r) => [r.estado_nuevo, r.cambiado_por]), [["PENDIENTE", "encargado@test.com"]]);
});

test("TDSI-1059: el historial no se puede borrar (DELETE y TRUNCATE rechazados)", async () => {
  const d = await crear();
  await assert.rejects(
    () => query("DELETE FROM devoluciones.historial_estados WHERE devolucion_id = $1", [d.id]),
    (e) => e.code === "DV002" && /\(DELETE\)/.test(e.message)
  );
  await assert.rejects(() => query("TRUNCATE devoluciones.historial_estados"), (e) => e.code === "DV002" && /\(TRUNCATE\)/.test(e.message));
  assert.equal((await filasHistorial(d.id)).rows.length, 1);
});

test("TDSI-1059: por la API tampoco: no hay ruta para editar ni borrar, y el error de la BD es 409", async () => {
  const d = await crear();
  for (const method of ["PUT", "PATCH", "DELETE", "POST"]) {
    const r = await pedir(`/${d.codigo}/historial`, { method, headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(r.status, 404, method);
  }
  let respuesta;
  const res = { status(s) { respuesta = { s }; return this; }, json(b) { respuesta.b = b; } };
  errorHandler(Object.assign(new Error("x"), { code: "DV002" }), {}, res);
  assert.deepEqual(respuesta, { s: 409, b: { ok: false, mensaje: "El historial de la devolución no se puede editar ni borrar.", detalle: null } });
});

test("TDSI-239: solo al borrar la devolucion completa se va su historial (lo usan las pruebas)", async () => {
  const d = await crear();
  await devolucionesRepo.cambiarEstado(d.codigo, "APROBADA", { usuario: "x" });
  await query("DELETE FROM devoluciones.devoluciones WHERE id = $1", [d.id]);
  assert.equal((await filasHistorial(d.id)).rows.length, 0);
});

test("TDSI-1057: historial de una devolucion que no existe -> 404; registrar sin usuario -> 400", async () => {
  const r = await pedir("/DEV-9999999999/historial");
  assert.equal(r.status, 404);
  assert.equal(r.cuerpo.mensaje, "Devolución no encontrada");

  for (const creado_por of [undefined, "", "   ", 5]) {
    const sin = await pedir("", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factura_numero: "F-000001", items: [{ item_id: 1, cantidad: 1 }], motivo_id: 1, opcion_reembolso: "VALE", creado_por }),
    });
    assert.equal(sin.status, 400, String(creado_por));
    assert.match(sin.cuerpo.mensaje, /^Indique quién registra la devolución/);
  }
});
