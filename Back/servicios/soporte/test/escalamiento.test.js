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
    async escalar(numero, { motivo, usuario }, validar) {
      if (numero !== ticket.numero) return null;
      validar({ actual: ticket.estado });
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
