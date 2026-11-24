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
