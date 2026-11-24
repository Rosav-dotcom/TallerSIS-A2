const { AppError } = require("../utils/AppError");

// TDSI-66: tickets (incidentes) de Soporte. Los valores son los CHECK de soporte.incidentes (TDSI-971).
const TIPOS = ["Facturacion", "Pagos", "Acceso", "Error del sistema", "Otro"];
const PRIORIDADES = ["Baja", "Media", "Alta", "Critica"];
const ESTADOS = ["Abierto", "En proceso", "Pendiente", "Resuelto", "Cerrado", "Escalado"];
const REFERENCIAS = ["factura", "transaccion"];
const FORMATO_REFERENCIA = /^[A-Za-z0-9_-]{1,60}$/;
const DESCRIPCION_MAX = 2000;
const TEXTO_MAX = 100;
const LIMITE_POR_DEFECTO = 20;
const LIMITE_MAXIMO = 100;

function texto(valor, campo, { requerido = false, max = TEXTO_MAX } = {}) {
  if (Array.isArray(valor) || (valor !== null && typeof valor === "object")) {
    throw new AppError(`El campo '${campo}' no es válido.`, 400);
  }
  const limpio = valor === undefined || valor === null ? "" : String(valor).trim();
  if (requerido && !limpio) throw new AppError(`El campo '${campo}' es obligatorio.`, 400);
  if (limpio.length > max) throw new AppError(`El campo '${campo}' admite hasta ${max} caracteres.`, 400);
  return limpio || null;
}

function deLista(valor, campo, lista, { requerido = false, porDefecto = null } = {}) {
  const limpio = texto(valor, campo, { requerido });
  if (!limpio) return porDefecto;
  if (!lista.includes(limpio)) throw new AppError(`El campo '${campo}' debe ser: ${lista.join(", ")}.`, 400);
  return limpio;
}

function entero(valor, campo, { porDefecto, min, max }) {
  if (valor === undefined || valor === null || valor === "") return porDefecto;
  if (Array.isArray(valor)) throw new AppError(`El parámetro '${campo}' debe enviarse una sola vez.`, 400);
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || (max !== undefined && numero > max)) {
    const rango = max !== undefined ? ` entre ${min} y ${max}` : ` desde ${min}`;
    throw new AppError(`El parámetro '${campo}' debe ser un entero${rango}.`, 400);
  }
  return numero;
}

/** Arma las condiciones SQL de la bandeja a partir de los filtros (TDSI-674 agrega los filtros). */
function construirFiltros() {
  return { condiciones: [], params: [] };
}

function crearTicketsService({ repo }) {
  return {
    /**
     * TDSI-668: registra un ticket. Nace en 'Abierto' con número correlativo; quien lo
     * registra sale de la sesión (req.usuario, TDSI-665), no del cuerpo del pedido.
     */
    async crearTicket(datos = {}, usuario = null) {
      const tipo = deLista(datos.tipo, "tipo", TIPOS, { requerido: true });
      const prioridad = deLista(datos.prioridad, "prioridad", PRIORIDADES, { porDefecto: "Media" });
      const descripcion = texto(datos.descripcion, "descripcion", { requerido: true, max: DESCRIPCION_MAX });
      const usuario_afectado = texto(datos.usuario_afectado, "usuario_afectado");

      const referencia_tipo = deLista(datos.referencia_tipo, "referencia_tipo", REFERENCIAS);
      const referencia = texto(datos.referencia, "referencia", { max: 60 });
      if (Boolean(referencia_tipo) !== Boolean(referencia)) {
        throw new AppError("La referencia necesita su tipo (factura o transaccion) y su número.", 400);
      }
      if (referencia && !FORMATO_REFERENCIA.test(referencia)) {
        throw new AppError("El número de la referencia no tiene un formato válido.", 400);
      }

      const registrado_por = (usuario && (usuario.email || usuario.nombre)) || texto(datos.registrado_por, "registrado_por", { requerido: true });

      return repo.crear({ tipo, prioridad, descripcion, usuario_afectado, referencia_tipo, referencia, registrado_por });
    },

    /**
     * TDSI-671: bandeja de tickets paginada, ordenada por prioridad (Critica primero) y,
     * dentro de cada prioridad, del más nuevo al más antiguo.
     * Responde { data, paginacion: { pagina, limite, total, paginas } }.
     */
    async listarTickets(consulta = {}) {
      const pagina = entero(consulta.pagina, "pagina", { porDefecto: 1, min: 1 });
      const limite = entero(consulta.limite, "limite", { porDefecto: LIMITE_POR_DEFECTO, min: 1, max: LIMITE_MAXIMO });
      const { condiciones, params } = construirFiltros(consulta);

      const { total, filas } = await repo.listar({ condiciones, params, limite, offset: (pagina - 1) * limite });
      return {
        data: filas,
        paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
      };
    },
  };
}

module.exports = { crearTicketsService, construirFiltros, TIPOS, PRIORIDADES, ESTADOS, REFERENCIAS, LIMITE_MAXIMO };
