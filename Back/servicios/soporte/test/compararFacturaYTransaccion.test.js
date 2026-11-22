// TDSI-973: tests de la detección de diferencias entre factura y transacción (TDSI-972)
const test = require("node:test");
const assert = require("node:assert/strict");
const { compararFacturaYTransaccion, normalizarTexto } = require("../src/domain/compararFacturaYTransaccion");

// Factura y transacción que coinciden; cada test cambia solo lo que prueba
const factura = (cambios = {}) => ({
  numero: "F-000123",
  venta_id: "TX-1",
  estado: "Emitida",
  total: 100,
  cliente: { nit: "1234567", nombre: "Juan Pérez" },
  metodos_pago: [{ metodo: "QR", monto: 100 }],
  ...cambios,
});
const transaccion = (cambios = {}) => ({
  id_transaccion: "TX-1",
  estado: "Registrado",
  estado_pago: "APROBADA",
  total: 100,
  metodos: [{ metodo: "QR", monto: 100 }],
  cliente: { nit: "1234567", razon_social: "Juan Pérez" },
  ...cambios,
});
const campos = (r) => r.diferencias.map((d) => d.campo).sort();

test("factura y transacción iguales: coincide sin diferencias ni avisos", () => {
  const r = compararFacturaYTransaccion(factura(), transaccion());
  assert.deepEqual(r, { coincide: true, diferencias: [], avisos: [] });
});

test("total distinto: marca la diferencia con los dos valores y el monto", () => {
  const r = compararFacturaYTransaccion(factura({ total: 110 }), transaccion());
  const d = r.diferencias.find((x) => x.campo === "total");
  assert.equal(r.coincide, false);
  assert.equal(d.factura, 110);
  assert.equal(d.transaccion, 100);
  assert.match(d.mensaje, /Bs\. 10\.00/);
});

test("diferencia menor a un centavo por redondeo no se marca", () => {
  const r = compararFacturaYTransaccion(
    factura({ total: 100.004, metodos_pago: [{ metodo: "QR", monto: "100.00" }] }),
    transaccion({ total: 100 })
  );
  assert.equal(r.coincide, true);
});

test("pago mixto que suma lo mismo por método: coincide", () => {
  const metodos = [
    { metodo: "Efectivo", monto: 60 },
    { metodo: "QR", monto: 40 },
  ];
  const r = compararFacturaYTransaccion(factura({ metodos_pago: metodos }), transaccion({ metodos: [...metodos].reverse() }));
  assert.equal(r.coincide, true);
});

test("pago mixto facturado como un solo método: marca el monto y el método que falta", () => {
  const r = compararFacturaYTransaccion(
    factura(),
    transaccion({ metodos: [{ metodo: "Efectivo", monto: 60 }, { metodo: "QR", monto: 40 }] })
  );
  assert.deepEqual(campos(r), ["metodo_pago.Efectivo", "metodo_pago.QR"]);
  const efectivo = r.diferencias.find((d) => d.campo === "metodo_pago.Efectivo");
  assert.equal(efectivo.factura, null);
  assert.equal(efectivo.transaccion, 60);
});

test("método en la factura que no se cobró", () => {
  const r = compararFacturaYTransaccion(factura({ metodos_pago: [{ metodo: "Tarjeta", monto: 100 }] }), transaccion());
  const tarjeta = r.diferencias.find((d) => d.campo === "metodo_pago.Tarjeta");
  assert.equal(tarjeta.transaccion, null);
  assert.match(tarjeta.mensaje, /no hay cobro/);
});

test("factura sin métodos de pago: no compara métodos y deja un aviso", () => {
  const r = compararFacturaYTransaccion(factura({ metodos_pago: [] }), transaccion());
  assert.equal(r.coincide, true);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /no registra métodos/);
});

test("NIT distinto o faltante en un lado se marca", () => {
  assert.deepEqual(campos(compararFacturaYTransaccion(factura({ cliente: { nit: "999", nombre: "Juan Pérez" } }), transaccion())), ["cliente.nit"]);
  assert.deepEqual(campos(compararFacturaYTransaccion(factura({ cliente: { nit: null, nombre: "Juan Pérez" } }), transaccion())), ["cliente.nit"]);
});

test("razón social se compara sin mayúsculas, tildes ni espacios extra", () => {
  const igual = compararFacturaYTransaccion(factura({ cliente: { nit: "1234567", nombre: "  JUAN   PEREZ " } }), transaccion());
  assert.equal(igual.coincide, true);
  const distinta = compararFacturaYTransaccion(factura({ cliente: { nit: "1234567", nombre: "Ana Rojas" } }), transaccion());
  assert.deepEqual(campos(distinta), ["cliente.razon_social"]);
});

test("venta sin datos de cliente en ningún lado (consumidor final): coincide", () => {
  const r = compararFacturaYTransaccion(
    factura({ cliente: { nit: null, nombre: null } }),
    transaccion({ cliente: { nit: null, razon_social: null } })
  );
  assert.equal(r.coincide, true);
});

test("factura anulada con pago registrado, y factura emitida con pago anulado", () => {
  const a = compararFacturaYTransaccion(factura({ estado: "Anulada" }), transaccion());
  assert.deepEqual(campos(a), ["estado"]);
  assert.match(a.diferencias[0].mensaje, /anulada/);

  const b = compararFacturaYTransaccion(factura(), transaccion({ estado: "Anulado" }));
  assert.deepEqual(campos(b), ["estado"]);
});

test("factura anulada con pago anulado: coincide", () => {
  const r = compararFacturaYTransaccion(factura({ estado: "Anulada" }), transaccion({ estado: "Anulado" }));
  assert.equal(r.coincide, true);
});

test("factura emitida con pago PENDIENTE o RECHAZADA se marca", () => {
  for (const estado_pago of ["PENDIENTE", "RECHAZADA"]) {
    const r = compararFacturaYTransaccion(factura(), transaccion({ estado_pago }));
    assert.deepEqual(campos(r), ["estado_pago"], estado_pago);
  }
});

test("anulación solicitada y borrador quedan como avisos, no como diferencias", () => {
  for (const estado of ["AnulacionSolicitada", "Borrador"]) {
    const r = compararFacturaYTransaccion(factura({ estado }), transaccion());
    assert.equal(r.coincide, true, estado);
    assert.equal(r.avisos.length, 1, estado);
  }
});

test("la factura apunta a otra transacción", () => {
  const r = compararFacturaYTransaccion(factura({ venta_id: "TX-9" }), transaccion());
  assert.deepEqual(campos(r), ["referencia"]);
});

test("transacción inexistente: una sola diferencia con el ID buscado", () => {
  const r = compararFacturaYTransaccion(factura(), null, { idBuscado: "TX-2" });
  assert.equal(r.coincide, false);
  assert.deepEqual(campos(r), ["transaccion"]);
  assert.match(r.diferencias[0].mensaje, /TX-2/);
});

test("varias diferencias a la vez se marcan todas", () => {
  const r = compararFacturaYTransaccion(
    factura({ total: 120, cliente: { nit: "1", nombre: "Otra" } }),
    transaccion({ estado_pago: "RECHAZADA" })
  );
  assert.deepEqual(campos(r), ["cliente.nit", "cliente.razon_social", "estado_pago", "total"]);
});

test("sin factura no se puede comparar", () => {
  assert.throws(() => compararFacturaYTransaccion(null, transaccion()), TypeError);
});

test("normalizarTexto", () => {
  assert.equal(normalizarTexto("  ÁRBOL   Ñandú "), "arbol nandu");
  assert.equal(normalizarTexto(null), "");
});
