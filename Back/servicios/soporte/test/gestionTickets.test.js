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
    historial,
    comentarios,
    async obtener(numero) {
      return numero === ticket.numero ? { ...ticket } : null;
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
  assert.deepEqual(repo.historial, [{ campo: "tipo", valor_anterior: "Pagos", valor_nuevo: "Acceso", usuario: "soporte@tallersis.bo" }]);
});

test("cambiar tipo: el mismo tipo no agrega historial; tipo inválido o faltante 400; sin sesión 401", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  await s.cambiarTipo("INC-000001", { tipo: "Pagos" }, SESION);
  assert.equal(repo.historial.length, 0);
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
