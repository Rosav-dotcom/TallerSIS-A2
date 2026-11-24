const { AppError } = require("../utils/AppError");
const { TIPOS, PRIORIDADES, ESTADOS, texto, deLista } = require("./ticketsService");
const { validarTransicion } = require("../domain/transicionesEstado");

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

    /** TDSI-680: cambia la prioridad y registra el cambio (valor anterior, nuevo, usuario y hora). */
    cambiarPrioridad(numero, datos = {}, usuario = null) {
      return cambiar(numero, "prioridad", PRIORIDADES, datos.prioridad, usuario);
    },

    /** TDSI-693: cambia el estado siguiendo las reglas de transición y lo deja en el historial. */
    async cambiarEstado(numero, datos = {}, usuario = null) {
      const n = numeroValido(numero);
      const nuevo = deLista(datos.estado, "estado", ESTADOS, { requerido: true });
      const ticket = await repo.cambiarEstado(n, nuevo, quien(usuario), ({ actual, tieneSolucion }) => {
        const error = validarTransicion({ actual, nuevo, tieneSolucion });
        if (error) throw new AppError(error.mensaje, error.status, { estado_actual: actual, permitidos: error.permitidos });
      });
      if (!ticket) throw noExiste(n);
      return ticket;
    },

    /**
     * TDSI-693: historial del ticket, del más antiguo al más nuevo.
     * Por defecto solo los cambios de estado: [{ id, estado_anterior, estado_nuevo, usuario, cambiado_en }].
     * Con ?campo=todos también los de tipo y prioridad (con campo, valor_anterior y valor_nuevo).
     */
    async historialTicket(numero, consulta = {}) {
      const n = numeroValido(numero);
      const campo = texto(consulta.campo, "campo", { max: 10 });
      if (campo && !["estado", "todos"].includes(campo)) throw new AppError("El parámetro 'campo' debe ser estado o todos.", 400);
      const filas = await repo.historial(n, { soloEstado: campo !== "todos" });
      if (!filas) throw noExiste(n);
      return filas.map((f) => ({
        id: f.id,
        campo: f.campo,
        valor_anterior: f.valor_anterior,
        valor_nuevo: f.valor_nuevo,
        estado_anterior: f.campo === "estado" ? f.valor_anterior : undefined,
        estado_nuevo: f.campo === "estado" ? f.valor_nuevo : undefined,
        usuario: f.usuario,
        cambiado_en: f.cambiado_en,
      }));
    },
  };
}

module.exports = { crearGestionTicketsService, numeroValido, quien, noExiste };
