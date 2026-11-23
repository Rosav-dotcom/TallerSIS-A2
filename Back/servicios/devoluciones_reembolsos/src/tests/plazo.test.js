// TDSI-69/1099: plazo de devolucion en dias habiles -- fin de semana, ultimo dia y fuera de
// plazo (PA TDSI-998, TDSI-999 y TDSI-1000), la configuracion del plazo (TDSI-1097) y el
// endpoint (TDSI-1098). Facturacion se reemplaza por un servidor falso; el plazo se lee de la
// BD real (devoluciones.configuracion) y se deja como estaba.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { evaluarPlazo, diasHabilesEntre, sumarDiasHabiles, diaLocal, esHabil } = require("../utils/diasHabiles");
const { plazoDeComprobante } = require("../services/plazoService");

// ---------- calculo (sin BD) ----------
// Noviembre 2026: viernes 20, sabado 21, domingo 22, lunes 23 ... martes 1/12, miercoles 2/12.
const bo = (dia, hora = "12:00") => `${dia}T${hora}:00-04:00`; // hora de Bolivia
const plazo = (emision, hoy, plazoDias = 7) => evaluarPlazo({ fechaEmision: bo(emision), plazoDias, hoy: bo(hoy) });

test("TDSI-1000: los sabados y domingos no se cuentan", () => {
  assert.equal(plazo("2026-11-20", "2026-11-21").dias_transcurridos, 0); // vie -> sab
  assert.equal(plazo("2026-11-20", "2026-11-22").dias_transcurridos, 0); // vie -> dom
  assert.equal(plazo("2026-11-20", "2026-11-23").dias_transcurridos, 1); // vie -> lun
  assert.equal(plazo("2026-11-20", "2026-11-27").dias_transcurridos, 5); // una semana = 5
  assert.equal(plazo("2026-11-20", "2026-12-04").dias_transcurridos, 10); // dos semanas = 10
  // compra en fin de semana: el lunes es el dia 1
  assert.equal(plazo("2026-11-21", "2026-11-23").dias_transcurridos, 1);
  assert.equal(plazo("2026-11-22", "2026-11-23").dias_transcurridos, 1);
  assert.equal(esHabil("2026-11-21"), false);
  assert.equal(esHabil("2026-11-23"), true);
});

test("TDSI-998: dentro del plazo, incluido el ultimo dia (fecha limite)", () => {
  const mismoDia = plazo("2026-11-20", "2026-11-20");
  assert.equal(mismoDia.dias_transcurridos, 0);
  assert.equal(mismoDia.dentro_de_plazo, true);

  const ultimo = plazo("2026-11-20", "2026-12-01");
  assert.deepEqual(ultimo, {
    fecha_emision: "2026-11-20", hoy: "2026-12-01", dias_transcurridos: 7, plazo_dias: 7,
    fecha_limite: "2026-12-01", dias_restantes: 0, dentro_de_plazo: true,
  });
  assert.equal(plazo("2026-11-20", "2026-11-30").dias_restantes, 1);
});

test("TDSI-999: al dia habil siguiente de la fecha limite ya esta fuera de plazo", () => {
  const fuera = plazo("2026-11-20", "2026-12-02");
  assert.equal(fuera.dias_transcurridos, 8);
  assert.equal(fuera.dentro_de_plazo, false);
  assert.equal(fuera.dias_restantes, 0);
  // si la fecha limite cae viernes, el sabado y el domingo siguen dentro; el lunes ya no
  const limiteViernes = sumarDiasHabiles("2026-11-18", 7);
  assert.equal(limiteViernes, "2026-11-27");
  assert.equal(plazo("2026-11-18", "2026-11-29").dentro_de_plazo, true);
  assert.equal(plazo("2026-11-18", "2026-11-30").dentro_de_plazo, false);
});

test("TDSI-215: el dia es el de Bolivia, no el del servidor (UTC)", () => {
  // viernes 23:30 en Bolivia = sabado 03:30 UTC: sigue siendo una compra del viernes
  assert.equal(diaLocal("2026-11-21T03:30:00Z"), "2026-11-20");
  const r = evaluarPlazo({ fechaEmision: "2026-11-21T03:30:00Z", plazoDias: 7, hoy: "2026-11-24T02:00:00Z" });
  assert.equal(r.fecha_emision, "2026-11-20");
  assert.equal(r.hoy, "2026-11-23"); // lunes 22:00 en Bolivia
  assert.equal(r.dias_transcurridos, 1);
});

test("TDSI-215: cambio de mes y de año, y otro plazo", () => {
  assert.equal(sumarDiasHabiles("2026-12-31", 3), "2027-01-05"); // jue -> vie 1, lun 4, mar 5
  assert.equal(diasHabilesEntre("2026-12-31", "2027-01-05"), 3);
  assert.equal(plazo("2026-11-20", "2026-12-04", 10).dentro_de_plazo, true);
  assert.equal(plazo("2026-11-20", "2026-12-07", 10).dentro_de_plazo, false);
  assert.equal(diasHabilesEntre("2026-11-23", "2026-11-20"), 0); // hoy antes de la emision
});

test("TDSI-1098: aviso y mensaje de la tarjeta del comprobante", async () => {
  const dentro = await plazoDeComprobante(bo("2026-11-20"), { plazoDias: 7, hoy: bo("2026-11-23") });
  assert.equal(dentro.aviso, "Todo en orden");
  assert.equal(dentro.mensaje, "Emitido hace 1 día hábil · Límite: 01/12/2026");
  const fuera = await plazoDeComprobante(bo("2026-11-20"), { plazoDias: 7, hoy: bo("2026-12-02") });
  assert.equal(fuera.aviso, "Revisión pendiente");
  assert.equal(fuera.mensaje, "Emitido hace 8 días hábiles · Límite: 01/12/2026");
});

// ---------- configuracion (BD) y endpoint (facturacion falso) ----------
const hoy = diaLocal();
/** Un dia con exactamente n dias habiles transcurridos hasta hoy. */
function haceDiasHabiles(n) {
  let d = hoy;
  while (diasHabilesEntre(d, hoy) < n || !esHabil(d)) d = new Date(Date.parse(`${d}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  while (diasHabilesEntre(d, hoy) > n) d = new Date(Date.parse(`${d}T00:00:00Z`) + 864e5).toISOString().slice(0, 10);
  return bo(d, "10:00");
}

const FACTURAS = {
  "F-000201": { numero: "F-000201", fecha: haceDiasHabiles(0), estado: "Emitida", cliente_nit: "7654321", cliente_nombre: "Ana" },
  "F-000202": { numero: "F-000202", fecha: haceDiasHabiles(7), estado: "Emitida", cliente_nit: "7654321", cliente_nombre: "Ana" },
  "F-000203": { numero: "F-000203", fecha: haceDiasHabiles(8), estado: "Emitida", cliente_nit: "7654321", cliente_nombre: "Ana" },
  "F-000204": { numero: "F-000204", fecha: haceDiasHabiles(1), estado: "Anulada", cliente_nit: "7654321", cliente_nombre: "Ana" },
};
for (const f of Object.values(FACTURAS)) {
  Object.assign(f, { canal: "Presencial", subtotal: "10", descuento: "0", impuesto: "0", total: "10", items: [], metodosPago: [] });
}

const falso = express();
falso.get("/api/facturas/buscar", (req, res) =>
  res.json({ ok: true, data: { criterio: "nit", facturas: Object.values(FACTURAS).filter((f) => f.cliente_nit === req.query.q) } }));
falso.get("/api/facturas/:numero", (req, res) => {
  const f = FACTURAS[req.params.numero];
  return f ? res.json({ ok: true, data: f }) : res.status(404).json({ ok: false });
});

let servidorFalso, servidor, base, query, pool, valorOriginal;
const pedir = async (ruta) => {
  const r = await fetch(`${base}${ruta}`);
  return { status: r.status, cuerpo: await r.json() };
};
const ponerPlazo = (valor) =>
  query("UPDATE devoluciones.configuracion SET valor = $1 WHERE clave = 'plazo_dias_habiles'", [valor]);

test.before(async () => {
  await new Promise((ok) => { servidorFalso = falso.listen(0, ok); });
  process.env.FACTURACION_URL = `http://localhost:${servidorFalso.address().port}`;
  ({ query, pool } = require("../config/db"));
  const { rows } = await query("SELECT valor FROM devoluciones.configuracion WHERE clave = 'plazo_dias_habiles'");
  assert.ok(rows[0], "Falta devoluciones.configuracion: corra sql/script_devoluciones.sql");
  valorOriginal = rows[0].valor;
  await ponerPlazo("7");
  const app = require("../app");
  await new Promise((ok) => { servidor = app.listen(0, ok); });
  base = `http://localhost:${servidor.address().port}/api/devoluciones`;
});

test.after(async () => {
  await new Promise((ok) => servidor.close(ok));
  await new Promise((ok) => servidorFalso.close(ok));
  await query(
    `INSERT INTO devoluciones.configuracion (clave, valor) VALUES ('plazo_dias_habiles', $1)
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor`,
    [valorOriginal]
  );
  await pool.end();
});

test("TDSI-1097: el plazo sale de la configuracion (por defecto 7) y se puede cambiar", async () => {
  assert.deepEqual((await pedir("/configuracion/plazo")).cuerpo.data.plazo_dias, 7);
  await ponerPlazo("10");
  const diez = (await pedir("/configuracion/plazo")).cuerpo.data;
  assert.equal(diez.plazo_dias, 10);
  assert.equal(diez.por_defecto, false);
  // con 10 dias, la compra de hace 8 vuelve a estar dentro
  assert.equal((await pedir("/comprobantes/F-000203/plazo")).cuerpo.data.dentro_de_plazo, true);
  await ponerPlazo("7");
});

test("TDSI-1097: sin la fila de configuracion se usa 7; la BD no acepta un plazo invalido", async () => {
  await query("DELETE FROM devoluciones.configuracion WHERE clave = 'plazo_dias_habiles'");
  try {
    const r = (await pedir("/configuracion/plazo")).cuerpo.data;
    assert.equal(r.plazo_dias, 7);
    assert.equal(r.por_defecto, true);
  } finally {
    await query("INSERT INTO devoluciones.configuracion (clave, valor) VALUES ('plazo_dias_habiles', '7')");
  }
  for (const malo of ["0", "61", "abc", "7.5", "-3"]) {
    await assert.rejects(() => ponerPlazo(malo), /configuracion_plazo_valido/, malo);
  }
});

test("TDSI-998: una compra dentro del plazo (hoy o en el ultimo dia) deja continuar", async () => {
  const hoyMismo = await pedir("/comprobantes/F-000201/plazo");
  assert.equal(hoyMismo.status, 200);
  assert.equal(hoyMismo.cuerpo.data.numero, "F-000201");
  assert.equal(hoyMismo.cuerpo.data.dias_transcurridos, 0);
  assert.equal(hoyMismo.cuerpo.data.dentro_de_plazo, true);
  assert.equal(hoyMismo.cuerpo.data.aviso, "Todo en orden");

  const ultimo = (await pedir("/comprobantes/F-000202/plazo")).cuerpo.data;
  assert.equal(ultimo.dias_transcurridos, 7);
  if (esHabil(hoy)) assert.equal(ultimo.fecha_limite, hoy); // en fin de semana la fecha limite fue el viernes
  assert.equal(ultimo.dentro_de_plazo, true);
});

test("TDSI-999: una compra fuera del plazo responde dentro_de_plazo=false con el aviso", async () => {
  const { status, cuerpo } = await pedir("/comprobantes/f-000203/plazo");
  assert.equal(status, 200);
  assert.equal(cuerpo.data.dias_transcurridos, 8);
  assert.equal(cuerpo.data.dentro_de_plazo, false);
  assert.equal(cuerpo.data.aviso, "Revisión pendiente");
  assert.match(cuerpo.data.mensaje, /^Emitido hace 8 días hábiles · Límite: \d{2}\/\d{2}\/\d{4}$/);
});

test("TDSI-1098: comprobante anulado o inexistente -> 404 como en TDSI-68", async () => {
  for (const n of ["F-000204", "F-999999"]) {
    const r = await pedir(`/comprobantes/${n}/plazo`);
    assert.equal(r.status, 404, n);
    assert.equal(r.cuerpo.mensaje, "Comprobante no encontrado o anulado");
  }
});

test("TDSI-1098: el detalle y la lista de compras tambien traen el plazo", async () => {
  const detalle = (await pedir("/comprobantes/F-000203")).cuerpo.data;
  assert.equal(detalle.plazo.dentro_de_plazo, false);
  assert.equal(detalle.plazo.dias_transcurridos, 8);

  const { compras } = (await pedir("/comprobantes?q=7654321")).cuerpo.data;
  assert.deepEqual(
    compras.map((c) => [c.numero, c.dias_transcurridos, c.dentro_de_plazo]),
    [["F-000201", 0, true], ["F-000202", 7, true], ["F-000203", 8, false]]
  );
});
