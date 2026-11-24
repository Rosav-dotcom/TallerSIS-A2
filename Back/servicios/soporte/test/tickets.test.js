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

// ---------------------------------------------------------------------------
// TDSI-671: bandeja paginada
// ---------------------------------------------------------------------------

function repoConLista(total = 45) {
  const pedidos = [];
  return {
    pedidos,
    async listar(args) {
      pedidos.push(args);
      const filas = Array.from({ length: Math.max(0, Math.min(args.limite, total - args.offset)) }, (_, i) => ({ id: args.offset + i + 1 }));
      return { total, filas };
    },
  };
}

test("listar: por defecto página 1 de 20, con el total y la cantidad de páginas", async () => {
  const repo = repoConLista(45);
  const r = await crearTicketsService({ repo }).listarTickets({});
  assert.deepEqual(r.paginacion, { pagina: 1, limite: 20, total: 45, paginas: 3 });
  assert.equal(r.data.length, 20);
  assert.equal(repo.pedidos[0].offset, 0);
  assert.equal(repo.pedidos[0].limite, 20);
});

test("listar: la página 3 de 20 empieza en el 41 y trae los 5 que quedan", async () => {
  const repo = repoConLista(45);
  const r = await crearTicketsService({ repo }).listarTickets({ pagina: "3", limite: "20" });
  assert.equal(repo.pedidos[0].offset, 40);
  assert.equal(r.data.length, 5);
  assert.equal(r.data[0].id, 41);
});

test("listar: una página que ya no existe devuelve vacío con el total", async () => {
  const r = await crearTicketsService({ repo: repoConLista(45) }).listarTickets({ pagina: 9 });
  assert.deepEqual(r.data, []);
  assert.equal(r.paginacion.total, 45);
});

test("listar: sin tickets, 0 páginas", async () => {
  const r = await crearTicketsService({ repo: repoConLista(0) }).listarTickets({});
  assert.deepEqual(r.paginacion, { pagina: 1, limite: 20, total: 0, paginas: 0 });
});

test("listar: pagina y limite inválidos (400)", async () => {
  const servicio = crearTicketsService({ repo: repoConLista() });
  for (const consulta of [{ pagina: 0 }, { pagina: "abc" }, { pagina: 1.5 }, { limite: 0 }, { limite: 101 }, { pagina: ["1", "2"] }]) {
    await assert.rejects(servicio.listarTickets(consulta), (e) => e.status === 400, JSON.stringify(consulta));
  }
});

test("GET /tickets: responde data y paginacion", async () => {
  const { servidor, base } = await levantar(crearTicketsService({ repo: repoConLista(3) }));
  try {
    const r = await fetch(`${base}/tickets?limite=2`);
    const cuerpo = await r.json();
    assert.equal(r.status, 200);
    assert.equal(cuerpo.data.length, 2);
    assert.deepEqual(cuerpo.paginacion, { pagina: 1, limite: 2, total: 3, paginas: 2 });
    assert.equal((await fetch(`${base}/tickets?pagina=-1`)).status, 400);
  } finally {
    servidor.close();
  }
});

// ---------------------------------------------------------------------------
// TDSI-674: filtros de la bandeja
// ---------------------------------------------------------------------------
const { construirFiltros } = require("../src/services/ticketsService");

test("filtros: sin filtros no hay condiciones", () => {
  assert.deepEqual(construirFiltros({}), { condiciones: [], params: [] });
  assert.deepEqual(construirFiltros({ numero: "  ", estado: "" }), { condiciones: [], params: [] });
});

test("filtros: se combinan todos, con parámetros numerados en orden", () => {
  const f = construirFiltros({ numero: "12", usuario: "Cajero1", desde: "2026-11-01", hasta: "2026-11-30", estado: "Abierto", prioridad: "Alta" });
  assert.deepEqual(f.params, ["%12%", "%Cajero1%", "2026-11-01", "2026-11-30", "Abierto", "Alta"]);
  assert.equal(f.condiciones.length, 6);
  assert.match(f.condiciones[0], /^numero ILIKE \$1$/);
  assert.match(f.condiciones[1], /^usuario_afectado ILIKE \$2$/);
  assert.match(f.condiciones[2], /creado_en >= \(\$3::date\)::timestamp AT TIME ZONE 'America\/La_Paz'/);
  assert.match(f.condiciones[3], /creado_en < \(\$4::date \+ 1\)/);
  assert.equal(f.condiciones[4], "estado = $5");
  assert.equal(f.condiciones[5], "prioridad = $6");
});

test("filtros: % y _ se buscan como texto, no como comodines", () => {
  assert.deepEqual(construirFiltros({ usuario: "50%_a" }).params, ["%50\\%\\_a%"]);
});

test("filtros: valores inválidos (400)", () => {
  const casos = [
    { estado: "Borrado" },
    { prioridad: "Urgente" },
    { desde: "24/11/2026" },
    { hasta: "2026-02-30" },
    { desde: "2026-12-01", hasta: "2026-11-01" },
    { numero: "x".repeat(21) },
    { usuario: ["a", "b"] },
  ];
  for (const consulta of casos) {
    assert.throws(() => construirFiltros(consulta), (e) => e.status === 400, JSON.stringify(consulta));
  }
});

test("listar: los filtros llegan al repositorio junto con la paginación", async () => {
  const repo = repoConLista(3);
  await crearTicketsService({ repo }).listarTickets({ prioridad: "Alta", limite: 5 });
  assert.deepEqual(repo.pedidos[0].condiciones, ["prioridad = $1"]);
  assert.deepEqual(repo.pedidos[0].params, ["Alta"]);
  assert.equal(repo.pedidos[0].limite, 5);
});
