// TDSI-72/1107: reglas de reembolso segun el metodo de pago original -- efectivo, tarjeta y
// pago mixto (PA TDSI-1013, TDSI-1014 y TDSI-1015), el endpoint (TDSI-1077) y la validacion al
// registrar (TDSI-1106). Facturacion se reemplaza por un servidor falso; las reglas y las
// devoluciones van a la BD real, y se deja todo como estaba.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { calcularOpciones, metodosDe } = require("../services/opcionesReembolsoService");

// ---------- reglas (sin BD): las mismas que carga sql/script_devoluciones.sql ----------
const REGLAS = [
  ["Efectivo", "EFECTIVO", true], ["Efectivo", "REVERSION_TARJETA", false, "La compra se pagó en efectivo: no hay un cobro con tarjeta que revertir."], ["Efectivo", "VALE", true],
  ["Tarjeta", "EFECTIVO", false, "Lo pagado con tarjeta se devuelve a la misma tarjeta (reversión electrónica) o con un vale, no en efectivo."], ["Tarjeta", "REVERSION_TARJETA", true], ["Tarjeta", "VALE", true],
  ["QR", "EFECTIVO", true], ["QR", "REVERSION_TARJETA", false, "Los pagos con QR no se pueden revertir en la pasarela: devuelva en efectivo o con un vale."], ["QR", "VALE", true],
].map(([metodo_pago, opcion, permitido, explicacion = null]) => ({ metodo_pago, opcion, permitido, explicacion }));

const habilitadas = (opciones) => opciones.filter((o) => o.habilitada).map((o) => o.nombre);

test("TDSI-1013: una compra en efectivo ofrece Efectivo y Vale", () => {
  const opciones = calcularOpciones(["Efectivo"], REGLAS);
  assert.deepEqual(opciones.map((o) => o.nombre), ["Efectivo", "Reversión electrónica", "Vale"]);
  assert.deepEqual(habilitadas(opciones), ["Efectivo", "Vale"]);
});

test("TDSI-1014: una compra con tarjeta no muestra Efectivo", () => {
  const opciones = calcularOpciones(["Tarjeta"], REGLAS);
  assert.deepEqual(habilitadas(opciones), ["Reversión electrónica", "Vale"]);
  assert.equal(opciones.find((o) => o.codigo === "EFECTIVO").habilitada, false);
});

test("TDSI-1015: toda opcion deshabilitada trae por que (y las habilitadas no)", () => {
  for (const metodos of [["Efectivo"], ["Tarjeta"], ["QR"], ["Efectivo", "Tarjeta"], ["Tarjeta", "QR"], [], ["Cheque"]]) {
    for (const o of calcularOpciones(metodos, REGLAS)) {
      if (o.habilitada) assert.equal(o.explicacion, null, `${metodos} ${o.codigo}`);
      else assert.ok(o.explicacion && o.explicacion.length > 10, `${metodos} ${o.codigo}`);
    }
  }
  assert.equal(calcularOpciones(["Tarjeta"], REGLAS)[0].explicacion,
    "Lo pagado con tarjeta se devuelve a la misma tarjeta (reversión electrónica) o con un vale, no en efectivo.");
});

test("TDSI-1107: QR ofrece Efectivo y Vale (la pasarela no revierte QR)", () => {
  const opciones = calcularOpciones(["QR"], REGLAS);
  assert.deepEqual(habilitadas(opciones), ["Efectivo", "Vale"]);
  assert.match(opciones[1].explicacion, /QR no se pueden revertir/);
});

test("TDSI-1107: pago mixto -> solo lo que permiten todos los metodos, diciendo cual bloquea", () => {
  const efectivoTarjeta = calcularOpciones(["Efectivo", "Tarjeta"], REGLAS);
  assert.deepEqual(habilitadas(efectivoTarjeta), ["Vale"]);
  assert.match(efectivoTarjeta[0].explicacion, /^Pago mixto \(Efectivo \+ Tarjeta\): no se permite por la parte pagada con Tarjeta\./);
  assert.match(efectivoTarjeta[1].explicacion, /parte pagada con Efectivo/);

  assert.deepEqual(habilitadas(calcularOpciones(["Efectivo", "QR"], REGLAS)), ["Efectivo", "Vale"]);
  assert.deepEqual(habilitadas(calcularOpciones(["Tarjeta", "QR"], REGLAS)), ["Vale"]);
  // metodosDe junta los repetidos (dos cobros en efectivo son un solo metodo)
  assert.deepEqual(metodosDe({ metodosPago: [{ metodo: "Efectivo" }, { metodo: "QR" }, { metodo: "Efectivo" }] }), ["Efectivo", "QR"]);
});

test("TDSI-1107: sin metodo registrado solo Vale; un metodo sin regla no habilita nada", () => {
  assert.deepEqual(habilitadas(calcularOpciones([], REGLAS)), ["Vale"]);
  const cheque = calcularOpciones(["Cheque"], REGLAS);
  assert.deepEqual(habilitadas(cheque), []);
  assert.equal(cheque[2].explicacion, "No hay una regla de reembolso para el pago con Cheque.");
});

// ---------- BD, endpoint y registro ----------
const SUF = String(Date.now()).slice(-8);
const N = (letra) => `T72-${SUF}-${letra}`;
let siguienteItem = 7000;
function factura(letra, metodos, extra = {}) {
  return {
    numero: N(letra), fecha: new Date().toISOString(), estado: "Emitida", cliente_nit: "1234567", cliente_nombre: "Ana",
    canal: "Presencial", subtotal: "30.00", descuento: "0", impuesto: "0", total: "30.00",
    items: [{ id: String(siguienteItem++), descripcion: "Aceite", cantidad: "2", precio_unitario: "15", subtotal: "30" }],
    metodosPago: metodos.map(([metodo, monto]) => ({ metodo, monto: String(monto) })), ...extra,
  };
}
const FACTURAS = Object.fromEntries([
  factura("E", [["Efectivo", 30]]),
  factura("T", [["Tarjeta", 30]]),
  factura("Q", [["QR", 30]]),
  factura("M", [["Efectivo", 10], ["Tarjeta", 20]]),
  factura("A", [["Efectivo", 30]], { estado: "Anulada" }),
].map((f) => [f.numero, f]));

const falso = express();
falso.get("/api/facturas/:numero", (req, res) => {
  const f = FACTURAS[req.params.numero];
  return f ? res.json({ ok: true, data: f }) : res.status(404).json({ ok: false });
});

let servidorFalso, servidor, base, query, pool, correlativoInicial, motivoId;
const pedir = async (ruta, cuerpo) => {
  const r = await fetch(`${base}${ruta}`, cuerpo === undefined ? undefined
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  return { status: r.status, cuerpo: await r.json() };
};
const registrar = (letra, opcion_reembolso) => pedir("", {
  factura_numero: N(letra), items: [{ item_id: Number(FACTURAS[N(letra)].items[0].id), cantidad: 1 }],
  motivo_id: motivoId, ...(opcion_reembolso === undefined ? {} : { opcion_reembolso }),
});

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.FACTURACION_URL = `http://localhost:${servidorFalso.address().port}`;
  ({ query, pool } = require("../config/db"));
  correlativoInicial = Number((await query("SELECT ultimo FROM devoluciones.correlativos WHERE nombre = 'devolucion'")).rows[0].ultimo);
  motivoId = Number((await query("SELECT id FROM devoluciones.motivos WHERE nombre = 'Producto vencido'")).rows[0].id);
  const app = require("../app");
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  const { rows } = await query("DELETE FROM devoluciones.devoluciones WHERE factura_numero LIKE $1 RETURNING codigo", [`T72-${SUF}-%`]);
  if (rows.length) {
    const ultimoMio = Math.max(...rows.map((r) => Number(r.codigo.slice(4))));
    await query("UPDATE devoluciones.correlativos SET ultimo = $1 WHERE nombre = 'devolucion' AND ultimo = $2", [correlativoInicial, ultimoMio]);
  }
  await pool.end();
});

test("TDSI-221: la BD tiene las mismas reglas que prueban los casos de arriba", async () => {
  const { rows } = await query(
    "SELECT metodo_pago, opcion, permitido, explicacion FROM devoluciones.reglas_reembolso WHERE metodo_pago IN ('Efectivo','Tarjeta','QR')"
  );
  const clave = (r) => `${r.metodo_pago}|${r.opcion}`;
  assert.deepEqual(
    rows.map((r) => [clave(r), r.permitido, r.explicacion]).sort(),
    REGLAS.map((r) => [clave(r), r.permitido, r.explicacion]).sort()
  );
  // una opcion bloqueada sin explicacion no se puede guardar
  await assert.rejects(() => query("INSERT INTO devoluciones.reglas_reembolso VALUES ('Prueba', 'VALE', false, NULL)"));
});

test("TDSI-1077: GET /comprobantes/:numero/opciones-reembolso segun como se pago", async () => {
  const efectivo = await pedir(`/comprobantes/${N("E")}/opciones-reembolso`);
  assert.equal(efectivo.status, 200);
  assert.equal(efectivo.cuerpo.data.numero, N("E"));
  assert.equal(efectivo.cuerpo.data.metodo_pago, "Efectivo");
  assert.deepEqual(efectivo.cuerpo.data.metodos, [{ metodo: "Efectivo", monto: 30 }]);
  assert.deepEqual(habilitadas(efectivo.cuerpo.data.opciones), ["Efectivo", "Vale"]);

  const tarjeta = (await pedir(`/comprobantes/${N("T")}/opciones-reembolso`)).cuerpo.data;
  assert.deepEqual(habilitadas(tarjeta.opciones), ["Reversión electrónica", "Vale"]);

  const mixto = (await pedir(`/comprobantes/${N("M")}/opciones-reembolso`)).cuerpo.data;
  assert.equal(mixto.metodo_pago, "Efectivo + Tarjeta");
  assert.deepEqual(habilitadas(mixto.opciones), ["Vale"]);

  // el detalle del comprobante trae las mismas opciones
  const detalle = (await pedir(`/comprobantes/${N("T")}`)).cuerpo.data;
  assert.deepEqual(detalle.opciones_reembolso, tarjeta.opciones);

  const anulada = await pedir(`/comprobantes/${N("A")}/opciones-reembolso`);
  assert.equal(anulada.status, 404);
  assert.equal(anulada.cuerpo.mensaje, "Comprobante no encontrado o anulado");
});

test("TDSI-1077: las reglas se leen de la BD (cambiar una regla cambia las opciones)", async () => {
  await query("UPDATE devoluciones.reglas_reembolso SET permitido = false, explicacion = 'Regla de prueba' WHERE metodo_pago = 'QR' AND opcion = 'EFECTIVO'");
  try {
    const qr = (await pedir(`/comprobantes/${N("Q")}/opciones-reembolso`)).cuerpo.data;
    assert.deepEqual(habilitadas(qr.opciones), ["Vale"]);
    assert.equal(qr.opciones[0].explicacion, "Regla de prueba");
  } finally {
    await query("UPDATE devoluciones.reglas_reembolso SET permitido = true, explicacion = NULL WHERE metodo_pago = 'QR' AND opcion = 'EFECTIVO'");
  }
});

test("TDSI-1106: al registrar, la opcion tiene que estar permitida para ese pago", async () => {
  const tarjetaEnEfectivo = await registrar("T", "EFECTIVO");
  assert.equal(tarjetaEnEfectivo.status, 422);
  assert.equal(tarjetaEnEfectivo.cuerpo.mensaje,
    "Lo pagado con tarjeta se devuelve a la misma tarjeta (reversión electrónica) o con un vale, no en efectivo.");
  assert.deepEqual(tarjetaEnEfectivo.cuerpo.detalle, { opcion_reembolso: "EFECTIVO", metodo_pago: "Tarjeta" });

  assert.equal((await registrar("E", "REVERSION_TARJETA")).status, 422);
  assert.equal((await registrar("M", "EFECTIVO")).status, 422);
  assert.equal((await registrar("M", "REVERSION_TARJETA")).status, 422);

  const reversion = await registrar("T", "REVERSION_TARJETA");
  assert.equal(reversion.status, 201);
  assert.deepEqual(reversion.cuerpo.data.opcion_reembolso, { codigo: "REVERSION_TARJETA", nombre: "Reversión electrónica" });
  // guardada: el detalle por codigo la trae igual
  assert.deepEqual((await pedir(`/${reversion.cuerpo.data.codigo}`)).cuerpo.data.opcion_reembolso, reversion.cuerpo.data.opcion_reembolso);

  assert.equal((await registrar("E", "efectivo")).status, 201); // en minusculas tambien
  assert.equal((await registrar("M", "VALE")).status, 201);
});

test("TDSI-1106: sin opcion o con una que no existe no se registra", async () => {
  const sin = await registrar("Q");
  assert.equal(sin.status, 400);
  assert.equal(sin.cuerpo.mensaje, "Elija cómo se devuelve el dinero (Efectivo, Reversión electrónica o Vale).");
  for (const opcion of ["", "TARJETA", "REVERSION_QR", 5]) {
    assert.equal((await registrar("Q", opcion)).status, 400, String(opcion));
  }
  const { rows } = await query("SELECT count(*)::int AS n FROM devoluciones.devoluciones WHERE factura_numero = $1", [N("Q")]);
  assert.equal(rows[0].n, 0);
});
