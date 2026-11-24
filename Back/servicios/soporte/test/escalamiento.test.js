// TDSI-65: escalar un incidente al Administrador (repositorio simulado, sin base de datos)
const test = require("node:test");
const assert = require("node:assert/strict");
const { crearGestionTicketsService } = require("../src/services/gestionTicketsService");
const { validarEscalamiento } = require("../src/domain/transicionesEstado");

const SESION = { email: "soporte@tallersis.bo", rol: "USUARIO_SOPORTE" };
const MOTIVO = "El cobro doble necesita autorización del administrador";

function repoFalso(inicial = {}) {
  const ticket = { id: 1, numero: "INC-000001", estado: "En proceso", ...inicial };
  return {
    ticket,
    historialFilas: [],
    async listarEscalados() {
      return ticket.estado === "Escalado" ? [{ ...ticket }] : [];
    },
    async historial(numero) {
      return numero === ticket.numero ? this.historialFilas : null;
    },
    async escalar(numero, { motivo, usuario }, validar) {
      if (numero !== ticket.numero) return null;
      validar({ actual: ticket.estado });
      this.historialFilas.push({ id: this.historialFilas.length + 1, campo: "estado", valor_anterior: ticket.estado, valor_nuevo: "Escalado", usuario, detalle: motivo, cambiado_en: "ahora" });
      Object.assign(ticket, { estado: "Escalado", motivo_escalamiento: motivo, escalado_por: usuario, escalado_en: "ahora" });
      return { ...ticket };
    },
  };
}

test("escalar: pasa a Escalado con el motivo, quién y cuándo", async () => {
  const repo = repoFalso();
  const t = await crearGestionTicketsService({ repo }).escalar("INC-000001", { motivo: `  ${MOTIVO}  `, usuario: "otro@x.bo" }, SESION);
  assert.equal(t.estado, "Escalado");
  assert.equal(t.motivo_escalamiento, MOTIVO);
  assert.equal(t.escalado_por, "soporte@tallersis.bo");
  assert.ok(t.escalado_en);
});

test("escalar: se puede desde Abierto, En proceso y Pendiente", async () => {
  for (const estado of ["Abierto", "En proceso", "Pendiente"]) {
    assert.equal(validarEscalamiento(estado), null, estado);
    const t = await crearGestionTicketsService({ repo: repoFalso({ estado }) }).escalar("INC-000001", { motivo: MOTIVO }, SESION);
    assert.equal(t.estado, "Escalado", estado);
  }
});

test("historial (TDSI-1092): el escalamiento queda con quién, cuándo y el motivo", async () => {
  const repo = repoFalso({ estado: "Pendiente" });
  const s = crearGestionTicketsService({ repo });
  await s.escalar("INC-000001", { motivo: MOTIVO }, SESION);
  const [cambio] = await s.historialTicket("INC-000001");
  assert.equal(cambio.estado_anterior, "Pendiente");
  assert.equal(cambio.estado_nuevo, "Escalado");
  assert.equal(cambio.usuario, "soporte@tallersis.bo");
  assert.equal(cambio.motivo, MOTIVO);
  assert.ok(cambio.cambiado_en);
});

test("bandeja de escalados (TDSI-1072): el Administrador la ve; el Usuario de Soporte no (403)", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  await s.escalar("INC-000001", { motivo: MOTIVO }, SESION);

  const bandeja = await s.listarEscalados({ email: "admin@tallersis.bo", rol: "ADMINISTRADOR" });
  assert.equal(bandeja.length, 1);
  assert.equal(bandeja[0].numero, "INC-000001");
  assert.equal(bandeja[0].motivo_escalamiento, MOTIVO);

  await assert.rejects(s.listarEscalados(SESION), (e) => e.status === 403);
  await assert.rejects(s.listarEscalados(null), (e) => e.status === 403);
});

// ---------------------------------------------------------------------------
// TDSI-1093: casos que no se pueden escalar
// ---------------------------------------------------------------------------

test("sin motivo no se escala (PA TDSI-981): vacío, solo espacios, muy corto o muy largo -> 400", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  for (const datos of [{}, { motivo: "   " }, { motivo: "corto" }, { motivo: "x".repeat(501) }, { motivo: ["a", "b"] }]) {
    await assert.rejects(s.escalar("INC-000001", datos, SESION), (e) => e.status === 400, JSON.stringify(datos).slice(0, 40));
  }
  assert.equal(repo.ticket.estado, "En proceso");
  assert.equal(repo.historialFilas.length, 0);
});

test("incidente resuelto o cerrado no se escala -> 409 y no cambia nada", async () => {
  for (const estado of ["Resuelto", "Cerrado"]) {
    const repo = repoFalso({ estado });
    await assert.rejects(
      crearGestionTicketsService({ repo }).escalar("INC-000001", { motivo: MOTIVO }, SESION),
      (e) => e.status === 409 && e.detalle.estado_actual === estado,
      estado
    );
    assert.equal(repo.ticket.estado, estado);
    assert.equal(repo.historialFilas.length, 0);
  }
});

test("doble escalamiento -> 409; el primero queda en el historial una sola vez", async () => {
  const repo = repoFalso();
  const s = crearGestionTicketsService({ repo });
  await s.escalar("INC-000001", { motivo: MOTIVO }, SESION);
  await assert.rejects(s.escalar("INC-000001", { motivo: MOTIVO }, SESION), (e) => e.status === 409 && /ya está escalado/.test(e.message));
  assert.equal(repo.historialFilas.length, 1);
});

test("ticket inexistente 404, número inválido 400, sin sesión 401", async () => {
  const s = crearGestionTicketsService({ repo: repoFalso() });
  await assert.rejects(s.escalar("INC-000999", { motivo: MOTIVO }, SESION), (e) => e.status === 404);
  await assert.rejects(s.escalar("INC-1", { motivo: MOTIVO }, SESION), (e) => e.status === 400);
  await assert.rejects(s.escalar("INC-000001", { motivo: MOTIVO }, null), (e) => e.status === 401);
});

test("después de escalar, el Administrador lo toma: Escalado -> En proceso está permitido", () => {
  const { validarTransicion } = require("../src/domain/transicionesEstado");
  assert.equal(validarTransicion({ actual: "Escalado", nuevo: "En proceso" }), null);
  assert.equal(validarTransicion({ actual: "Escalado", nuevo: "Resuelto", tieneSolucion: true }).status, 409);
});

// ---------------------------------------------------------------------------
// Rutas HTTP
// ---------------------------------------------------------------------------

test("rutas: POST /escalar y GET /escalados según el rol de la sesión", async () => {
  const express = require("express");
  const { crearSoporteRoutes } = require("../src/routes/soporteRoutes");
  const { errorHandler } = require("../src/middlewares/errorHandler");
  const service = crearGestionTicketsService({ repo: repoFalso() });

  const app = express();
  app.use(express.json());
  // La prueba elige la sesión con el header x-rol (en producción la pone requireRol, TDSI-665)
  app.use("/api/soporte", (req, res, next) => {
    req.usuario = { email: `${req.headers["x-rol"]}@tallersis.bo`, rol: req.headers["x-rol"] };
    next();
  }, crearSoporteRoutes({ gestionTicketsService: service }));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const x = app.listen(0, () => ok(x)); });
  const base = `http://127.0.0.1:${servidor.address().port}/api/soporte`;
  const pedir = (ruta, rol, opciones = {}) =>
    fetch(base + ruta, { ...opciones, headers: { "Content-Type": "application/json", "x-rol": rol } });

  try {
    assert.equal((await pedir("/tickets/INC-000001/escalar", "USUARIO_SOPORTE", { method: "POST", body: "{}" })).status, 400);
    const ok = await pedir("/tickets/INC-000001/escalar", "USUARIO_SOPORTE", { method: "POST", body: JSON.stringify({ motivo: MOTIVO }) });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).data.estado, "Escalado");
    assert.equal((await pedir("/tickets/INC-000001/escalar", "USUARIO_SOPORTE", { method: "POST", body: JSON.stringify({ motivo: MOTIVO }) })).status, 409);

    assert.equal((await pedir("/escalados", "USUARIO_SOPORTE")).status, 403);
    const bandeja = await pedir("/escalados", "ADMINISTRADOR");
    assert.equal(bandeja.status, 200);
    assert.equal((await bandeja.json()).total, 1);
  } finally {
    servidor.close();
  }
});
