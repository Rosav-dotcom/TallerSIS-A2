const { AppError } = require("../utils/AppError");
const { TIPOS, PRIORIDADES, ESTADOS, texto, deLista } = require("./ticketsService");

// TDSI-64: gestionar cada ticket (detalle, tipo, prioridad, estado, solución y comentarios).
// Quien hace cada cambio sale de la sesión (req.usuario, TDSI-665), nunca del cuerpo del pedido.

const FORMATO_NUMERO = /^INC-\d{6}$/;

function numeroValido(numero) {
  const limpio = String(numero || "").trim().toUpperCase();
  if (!FORMATO_NUMERO.test(limpio)) {
    throw new AppError("Número de ticket inválido", 400, "Use el formato INC-000123");
  }
  return limpio;
}

function quien(usuario) {
  const nombre = usuario && (usuario.email || usuario.nombre);
  if (!nombre) throw new AppError("No se pudo identificar al usuario de la sesión.", 401);
  return nombre;
}

const noExiste = (numero) => new AppError(`No hay ningún incidente con el número ${numero}.`, 404);

function crearGestionTicketsService({ repo }) {
  async function cambiar(numero, campo, lista, valor, usuario) {
    const n = numeroValido(numero);
    const nuevo = deLista(valor, campo, lista, { requerido: true });
    const r = await repo.cambiarCampo(n, campo, nuevo, quien(usuario));
    if (!r) throw noExiste(n);
    return r.ticket;
  }

  return {
    /** TDSI-677: catálogo de tipos (y de prioridades y estados) para los selectores. */
    catalogos() {
      return { tipos: TIPOS, prioridades: PRIORIDADES, estados: ESTADOS };
    },

    /** TDSI-677: detalle de un ticket, con su solución si la tiene. */
    async obtenerTicket(numero) {
      const n = numeroValido(numero);
      const ticket = await repo.obtener(n);
      if (!ticket) throw noExiste(n);
      return ticket;
    },

    /** TDSI-677: cambia el tipo y lo deja en el historial. */
    cambiarTipo(numero, datos = {}, usuario = null) {
      return cambiar(numero, "tipo", TIPOS, datos.tipo, usuario);
    },
  };
}

module.exports = { crearGestionTicketsService, numeroValido, quien, noExiste };
