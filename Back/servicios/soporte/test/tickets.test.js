// TDSI-66: tickets de Soporte (repositorio simulado, sin base de datos)
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { crearTicketsService } = require("../src/services/ticketsService");
const { crearSoporteRoutes } = require("../src/routes/soporteRoutes");
const { errorHandler } = require("../src/middlewares/errorHandler");

const SESION = { usuario_id: "u1", email: "soporte@tallersis.bo", nombre: "Ana", rol: "USUARIO_SOPORTE" };

// Repo falso: guarda lo que recibe y simula la secuencia y el estado inicial de la tabla
function repoFalso() {
  const guardados = [];
  return {
    guardados,
    async crear(datos) {
      const fila = { id: guardados.length + 1, numero: `INC-${String(guardados.length + 1).padStart(6, "0")}`, estado: "Abierto", ...datos };
      guardados.push(fila);
      return fila;
    },
  };
}

const VALIDO = { tipo: "Pagos", prioridad: "Alta", descripcion: "  El cobro QR no se refleja  ", referencia_tipo: "transaccion", referencia: "VTA-022675" };

// ---------------------------------------------------------------------------
// TDSI-668: crear ticket
// ---------------------------------------------------------------------------

test("crear: nace Abierto con número correlativo y la descripción sin espacios de más", async () => {
  const repo = repoFalso();
  const servicio = crearTicketsService({ repo });
  const uno = await servicio.crearTicket(VALIDO, SESION);
  const dos = await servicio.crearTicket({ tipo: "Otro", descripcion: "Otro problema" }, SESION);

  assert.equal(uno.numero, "INC-000001");
  assert.equal(dos.numero, "INC-000002");
  assert.equal(uno.estado, "Abierto");
  assert.deepEqual(repo.guardados[0], {
    id: 1, numero: "INC-000001", estado: "Abierto",
    tipo: "Pagos", prioridad: "Alta", descripcion: "El cobro QR no se refleja", usuario_afectado: null,
    referencia_tipo: "transaccion", referencia: "VTA-022675", registrado_por: "soporte@tallersis.bo",
  });
});

test("crear: sin prioridad queda Media; sin referencia, las dos van vacías", async () => {
  const repo = repoFalso();
  await crearTicketsService({ repo }).crearTicket({ tipo: "Acceso", descripcion: "No puede entrar", usuario_afectado: "cajero1@tallersis.bo" }, SESION);
  assert.equal(repo.guardados[0].prioridad, "Media");
  assert.equal(repo.guardados[0].referencia_tipo, null);
  assert.equal(repo.guardados[0].referencia, null);
  assert.equal(repo.guardados[0].usuario_afectado, "cajero1@tallersis.bo");
});

test("crear: quien registra sale de la sesión, no del cuerpo del pedido", async () => {
  const repo = repoFalso();
  await crearTicketsService({ repo }).crearTicket({ ...VALIDO, registrado_por: "otro@tallersis.bo", estado: "Cerrado" }, SESION);
  assert.equal(repo.guardados[0].registrado_por, "soporte@tallersis.bo");
  assert.equal(repo.guardados[0].estado, "Abierto"); // el estado del cuerpo se ignora
});

test("crear: validaciones (400)", async () => {
  const servicio = crearTicketsService({ repo: repoFalso() });
  const casos = [
    [{ ...VALIDO, tipo: undefined }, /tipo/],
    [{ ...VALIDO, tipo: "Hardware" }, /tipo/],
    [{ ...VALIDO, prioridad: "Urgente" }, /prioridad/],
    [{ ...VALIDO, descripcion: "   " }, /descripcion/],
    [{ ...VALIDO, descripcion: "x".repeat(2001) }, /2000/],
    [{ ...VALIDO, referencia_tipo: undefined }, /referencia/],
    [{ ...VALIDO, referencia: undefined }, /referencia/],
    [{ ...VALIDO, referencia_tipo: "cliente" }, /referencia_tipo/],
    [{ ...VALIDO, referencia: "VTA 1; DROP" }, /formato/],
    [{ ...VALIDO, usuario_afectado: ["a", "b"] }, /usuario_afectado/],
  ];
  for (const [datos, mensaje] of casos) {
    await assert.rejects(servicio.crearTicket(datos, SESION), (e) => e.status === 400 && mensaje.test(e.message), JSON.stringify(datos).slice(0, 80));
  }
});

// ---------------------------------------------------------------------------
// Ruta HTTP
// ---------------------------------------------------------------------------

async function levantar(ticketsService) {
  const app = express();
  app.use(express.json());
  app.use("/api/soporte", (req, res, next) => { req.usuario = SESION; next(); }, crearSoporteRoutes({ ticketsService }));
  app.use(errorHandler);
  const servidor = await new Promise((ok) => { const s = app.listen(0, () => ok(s)); });
  return { servidor, base: `http://127.0.0.1:${servidor.address().port}/api/soporte` };
}

test("POST /tickets: 201 con el ticket; 400 si falta la descripción", async () => {
  const repo = repoFalso();
  const { servidor, base } = await levantar(crearTicketsService({ repo }));
  const enviar = (cuerpo) => fetch(`${base}/tickets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  try {
    const r = await enviar(VALIDO);
    const cuerpo = await r.json();
    assert.equal(r.status, 201);
    assert.equal(cuerpo.data.numero, "INC-000001");
    assert.equal(cuerpo.data.estado, "Abierto");
    assert.equal((await enviar({ tipo: "Pagos" })).status, 400);
  } finally {
    servidor.close();
  }
});
