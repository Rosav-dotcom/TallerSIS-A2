// TDSI-693: reglas de transición del estado (función pura)
const test = require("node:test");
const assert = require("node:assert/strict");
const { validarTransicion, TRANSICIONES } = require("../src/domain/transicionesEstado");

const ok = (actual, nuevo, tieneSolucion = false) => validarTransicion({ actual, nuevo, tieneSolucion }) === null;

test("transiciones permitidas", () => {
  assert.ok(ok("Abierto", "En proceso"));
  assert.ok(ok("Abierto", "Pendiente"));
  assert.ok(ok("En proceso", "Pendiente"));
  assert.ok(ok("Pendiente", "En proceso"));
  assert.ok(ok("Escalado", "En proceso"));
  assert.ok(ok("Resuelto", "Cerrado"));
  assert.ok(ok("Resuelto", "En proceso"));
});

test("Resuelto solo con solución registrada (PA TDSI-978)", () => {
  for (const desde of ["Abierto", "En proceso", "Pendiente"]) {
    const sin = validarTransicion({ actual: desde, nuevo: "Resuelto", tieneSolucion: false });
    assert.equal(sin.status, 409, desde);
    assert.match(sin.mensaje, /solución/);
    assert.ok(ok(desde, "Resuelto", true), desde);
  }
});

test("no permitidas: Cerrado es final, no se cierra sin resolver, no se escala a mano, ni al mismo estado", () => {
  assert.match(validarTransicion({ actual: "Cerrado", nuevo: "En proceso" }).mensaje, /estado final/);
  assert.match(validarTransicion({ actual: "Abierto", nuevo: "Cerrado" }).mensaje, /Abierto a Cerrado/);
  assert.match(validarTransicion({ actual: "En proceso", nuevo: "Escalado" }).mensaje, /escalamiento/);
  assert.match(validarTransicion({ actual: "Pendiente", nuevo: "Pendiente" }).mensaje, /ya está/);
  assert.deepEqual(validarTransicion({ actual: "Abierto", nuevo: "Cerrado" }).permitidos, ["En proceso", "Pendiente", "Resuelto"]);
});

test("todos los estados de la tabla tienen sus reglas", () => {
  assert.deepEqual(Object.keys(TRANSICIONES).sort(), ["Abierto", "Cerrado", "En proceso", "Escalado", "Pendiente", "Resuelto"]);
});
