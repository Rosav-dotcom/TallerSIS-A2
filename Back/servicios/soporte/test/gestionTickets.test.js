// TDSI-64: gestionar cada ticket (repositorio simulado, sin base de datos)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { crearGestionTicketsService } = require("../src/services/gestionTicketsService");
const { crearSoporteRoutes } = require("../src/routes/soporteRoutes");
const { errorHandler } = require("../src/middlewares/errorHandler");

const SESION = { usuario_id: "u1", email: "soporte@tallersis.bo", nombre: "Ana", rol: "USUARIO_SOPORTE" };

// Repo falso con un ticket en memoria y su historial
function repoFalso(inicial = {}) {
  const ticket = { id: 1, numero: "INC-000001", tipo: "Pagos", prioridad: "Media", estado: "Abierto", solucion: null, ...inicial };
  const historial = [];
  const comentarios = [];
  return {
    ticket,
    cambios: historial,
    comentarios,
    async obtener(numero) {
      return numero === ticket.numero ? { ...ticket } : null;
    },
    async cambiarEstado(numero, nuevo, usuario, validar) {
      if (numero !== ticket.numero) return null;
      validar({ actual: ticket.estado, tieneSolucion: Boolean(ticket.solucion) });
      historial.push({ campo: "estado", valor_anterior: ticket.estado, valor_nuevo: nuevo, usuario });
      ticket.estado = nuevo;
      return { ...ticket };
    },
    async historial(numero, { soloEstado }) {
      if (numero !== ticket.numero) return null;
      return historial
        .filter((h) => !soloEstado || h.campo === "estado")
        .map((h, i) => ({ id: i + 1, cambiado_en: `2026-11-24T10:0${i}:00Z`, ...h }));
    },
    async cambiarCampo(numero, campo, valor, usuario) {
      if (numero !== ticket.numero) return null;
      if (ticket[campo] === valor) return { sinCambio: true, ticket: { ...ticket } };
      historial.push({ campo, valor_anterior: ticket[campo], valor_nuevo: valor, usuario });
      ticket[campo] = valor;
      return { sinCambio: false, ticket: { ...ticket } };
    },
  };
}

async function levantar(gestionTicketsService) {
  const app = express();
  app.use(express.json());
  app.use("/api/soporte", (req, res, next) => { req.usuario = SESION; next(); }, crearSoporteRoutes({ gestionTicketsService }));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/soporte`;
  const pedir = async (ruta, metodo = "GET", cuerpo) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: r.status, cuerpo: await r.json() };
  };
  return { servidor, pedir };
}

// ---------------------------------------------------------------------------
// TDSI-677: catálogo, detalle y tipo
// ---------------------------------------------------------------------------

test("catálogo: los 5 tipos, 4 prioridades y los estados de la tabla", () => {
  const c = crearGestionTicketsService({ repo: repoFalso() }).catalogos();
  assert.deepEqual(c.tipos, ["Facturacion", "Pagos", "Acceso", "Error del sistema", "Otro"]);
  assert.deepEqual(c.prioridades, ["Baja", "Media", "Alta", "Critica"]);
  assert.ok(c.estados.includes("Abierto") && c.estados.includes("Cerrado"));
});

test("detalle: acepta el número en minúsculas; 404 si no existe; 400 si el formato es inválido", async () => {
  const s = crearGestionTicketsService({ repo: repoFalso() });
  assert.equal((await s.obtenerTicket("inc-000001")).numero, "INC-000001");
  await assert.rejects(s.obtenerTicket("INC-000999"), (e) => e.status === 404 && /INC-000999/.test(e.message));
  for (const malo of ["", "INC-1", "123", "INC-000001; DROP"]) {
    await assert.rejects(s.obtenerTicket(malo), (e) => e.status === 400, malo);
  }
});

test("cambiar tipo: guarda el nuevo y lo registra con el usuario de la sesión (no el del cuerpo)", async () => {
  const repo = repoFalso();
  const t = await crearGestionTicketsService({ repo }).cambiarTipo("INC-000001", { tipo: "Acceso", usuario: "otro@x.bo" }, SESION);
  assert.equal(t.tipo, "Acceso");
  assert.deepEqual(repo.cambios, [{ campo: "tipo", valor_anterior: "Pagos", valor_nuevo: "Acceso", usuario: "soporte@tallersis.bo" }]);
});

test("cambiar tipo: el mismo tipo no agrega historial; tipo inválido o faltante 400; sin sesión 401", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  await s.cambiarTipo("INC-000001", { tipo: "Pagos" }, SESION);
  assert.equal(repo.cambios.length, 0);
  await assert.rejects(s.cambiarTipo("INC-000001", { tipo: "Hardware" }, SESION), (e) => e.status === 400);
  await assert.rejects(s.cambiarTipo("INC-000001", {}, SESION), (e) => e.status === 400);
  await assert.rejects(s.cambiarTipo("INC-000001", { tipo: "Otro" }, null), (e) => e.status === 401);
  await assert.rejects(s.cambiarTipo("INC-000777", { tipo: "Otro" }, SESION), (e) => e.status === 404);
});

test("rutas TDSI-677: GET /catalogos, GET /tickets/:numero y PATCH /tipo", async () => {
  const repo = repoFalso();
  const { servidor, pedir } = await levantar(crearGestionTicketsService({ repo }));
  try {
    assert.equal((await pedir("/catalogos")).cuerpo.data.tipos.length, 5);
    const detalle = await pedir("/tickets/INC-000001");
    assert.equal(detalle.status, 200);
    assert.equal(detalle.cuerpo.data.tipo, "Pagos");
    assert.equal((await pedir("/tickets/INC-000002")).status, 404);
    const cambio = await pedir("/tickets/INC-000001/tipo", "PATCH", { tipo: "Otro" });
    assert.equal(cambio.status, 200);
    assert.equal(cambio.cuerpo.data.tipo, "Otro");
  } finally {
    servidor.close();
  }
});

// ---------------------------------------------------------------------------
// TDSI-680: prioridad
// ---------------------------------------------------------------------------

test("cambiar prioridad: guarda el cambio con valor anterior, nuevo y usuario", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  const t = await s.cambiarPrioridad("INC-000001", { prioridad: "Critica" }, SESION);
  assert.equal(t.prioridad, "Critica");
  await s.cambiarPrioridad("INC-000001", { prioridad: "Alta" }, SESION);
  assert.deepEqual(repo.cambios, [
    { campo: "prioridad", valor_anterior: "Media", valor_nuevo: "Critica", usuario: "soporte@tallersis.bo" },
    { campo: "prioridad", valor_anterior: "Critica", valor_nuevo: "Alta", usuario: "soporte@tallersis.bo" },
  ]);
});

test("cambiar prioridad: valor inválido 400 (Crítica con tilde no es el valor guardado); misma prioridad sin historial", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  await assert.rejects(s.cambiarPrioridad("INC-000001", { prioridad: "Urgente" }, SESION), (e) => e.status === 400);
  await assert.rejects(s.cambiarPrioridad("INC-000001", { prioridad: "Crítica" }, SESION), (e) => e.status === 400);
  await s.cambiarPrioridad("INC-000001", { prioridad: "Media" }, SESION);
  assert.equal(repo.cambios.length, 0);
});

test("ruta PATCH /tickets/:numero/prioridad", async () => {
  const { servidor, pedir } = await levantar(crearGestionTicketsService({ repo: repoFalso() }));
  try {
    const r = await pedir("/tickets/INC-000001/prioridad", "PATCH", { prioridad: "Baja" });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.data.prioridad, "Baja");
    assert.equal((await pedir("/tickets/INC-000001/prioridad", "PATCH", {})).status, 400);
  } finally {
    servidor.close();
  }
});

// ---------------------------------------------------------------------------
// TDSI-693: estado e historial
// ---------------------------------------------------------------------------

test("cambiar estado: sigue las reglas y deja cada cambio en el historial con usuario", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  assert.equal((await s.cambiarEstado("INC-000001", { estado: "En proceso" }, SESION)).estado, "En proceso");
  await s.cambiarEstado("INC-000001", { estado: "Pendiente" }, SESION);
  const h = await s.historialTicket("INC-000001");
  assert.deepEqual(h.map((x) => [x.estado_anterior, x.estado_nuevo, x.usuario]), [
    ["Abierto", "En proceso", "soporte@tallersis.bo"],
    ["En proceso", "Pendiente", "soporte@tallersis.bo"],
  ]);
  assert.ok(h[0].cambiado_en && h[0].id);
});

test("cambiar estado: no permitido 409 con los permitidos; Resuelto sin solución 409; estado inválido 400", async () => {
  const s = crearGestionTicketsService({ repo: repoFalso() });
  await assert.rejects(
    s.cambiarEstado("INC-000001", { estado: "Cerrado" }, SESION),
    (e) => e.status === 409 && e.detalle.estado_actual === "Abierto" && e.detalle.permitidos.includes("En proceso")
  );
  await assert.rejects(s.cambiarEstado("INC-000001", { estado: "Resuelto" }, SESION), (e) => e.status === 409 && /solución/.test(e.message));
  await assert.rejects(s.cambiarEstado("INC-000001", { estado: "Borrado" }, SESION), (e) => e.status === 400);
  await assert.rejects(s.cambiarEstado("INC-000404", { estado: "Pendiente" }, SESION), (e) => e.status === 404);
});

test("cambiar estado: con solución registrada sí se puede pasar a Resuelto", async () => {
  const s = crearGestionTicketsService({ repo: repoFalso({ estado: "En proceso", solucion: "Se corrigió el NIT" }) });
  assert.equal((await s.cambiarEstado("INC-000001", { estado: "Resuelto" }, SESION)).estado, "Resuelto");
});

test("historial: por defecto solo estado; con campo=todos también tipo y prioridad; campo inválido 400", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  await s.cambiarTipo("INC-000001", { tipo: "Acceso" }, SESION);
  await s.cambiarEstado("INC-000001", { estado: "En proceso" }, SESION);
  assert.equal((await s.historialTicket("INC-000001")).length, 1);
  const todos = await s.historialTicket("INC-000001", { campo: "todos" });
  assert.deepEqual(todos.map((x) => x.campo), ["tipo", "estado"]);
  assert.equal(todos[0].estado_nuevo, undefined);
  await assert.rejects(s.historialTicket("INC-000001", { campo: "otro" }), (e) => e.status === 400);
  await assert.rejects(s.historialTicket("INC-000404"), (e) => e.status === 404);
});

test("rutas PATCH /estado y GET /historial", async () => {
  const { servidor, pedir } = await levantar(crearGestionTicketsService({ repo: repoFalso() }));
  try {
    const r = await pedir("/tickets/INC-000001/estado", "PATCH", { estado: "En proceso" });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.data.estado, "En proceso");
    assert.equal((await pedir("/tickets/INC-000001/estado", "PATCH", { estado: "Abierto" })).status, 409);
    const h = await pedir("/tickets/INC-000001/historial");
    assert.equal(h.cuerpo.total, 1);
    assert.equal(h.cuerpo.data[0].estado_nuevo, "En proceso");
  } finally {
    servidor.close();
  }
});
