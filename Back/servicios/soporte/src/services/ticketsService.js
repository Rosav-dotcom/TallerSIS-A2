const { AppError } = require("../utils/AppError");

// TDSI-66: tickets (incidentes) de Soporte. Los valores son los CHECK de soporte.incidentes (TDSI-971).
const TIPOS = ["Facturacion", "Pagos", "Acceso", "Error del sistema", "Otro"];
const PRIORIDADES = ["Baja", "Media", "Alta", "Critica"];
const ESTADOS = ["Abierto", "En proceso", "Pendiente", "Resuelto", "Cerrado", "Escalado"];
const REFERENCIAS = ["factura", "transaccion"];
const ESTADOS_FINALES = ["Resuelto", "Cerrado"];
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

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ZONA = "America/La_Paz"; // los días se cuentan en hora de Bolivia

// Escapa % _ y \ para que el texto se busque tal cual dentro de un ILIKE
const paraLike = (texto) => `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function fecha(valor, campo) {
  const limpio = texto(valor, campo, { max: 10 });
  if (!limpio) return null;
  const d = new Date(`${limpio}T00:00:00Z`);
  if (!FORMATO_FECHA.test(limpio) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== limpio) {
    throw new AppError(`El parámetro '${campo}' debe ser una fecha AAAA-MM-DD.`, 400);
  }
  return limpio;
}

/**
 * TDSI-674: arma las condiciones SQL de la bandeja. Los filtros se combinan (todos a la vez):
 *   numero     parte del número del ticket (INC-000012, "12", "inc-0000")
 *   usuario    parte del usuario afectado (correo o nombre), sin distinguir mayúsculas
 *   desde      AAAA-MM-DD, desde el inicio de ese día (hora de Bolivia)
 *   hasta      AAAA-MM-DD, hasta el final de ese día (incluido)
 *   estado     Abierto, En proceso, Pendiente, Resuelto, Cerrado o Escalado
 *   prioridad  Baja, Media, Alta o Critica
 */
function construirFiltros(consulta = {}) {
  const condiciones = [];
  const params = [];
  const agregar = (sql, valor) => {
    params.push(valor);
    condiciones.push(sql.replace("?", `$${params.length}`));
  };

  const numero = texto(consulta.numero, "numero", { max: 20 });
  if (numero) agregar("numero ILIKE ?", paraLike(numero));

  const usuario = texto(consulta.usuario, "usuario");
  if (usuario) agregar("usuario_afectado ILIKE ?", paraLike(usuario));

  const desde = fecha(consulta.desde, "desde");
  const hasta = fecha(consulta.hasta, "hasta");
  if (desde && hasta && desde > hasta) {
    throw new AppError("La fecha 'desde' no puede ser posterior a 'hasta'.", 400);
  }
  if (desde) agregar(`creado_en >= (?::date)::timestamp AT TIME ZONE '${ZONA}'`, desde);
  if (hasta) agregar(`creado_en < (?::date + 1)::timestamp AT TIME ZONE '${ZONA}'`, hasta);

  const estado = deLista(consulta.estado, "estado", ESTADOS);
  if (estado) agregar("estado = ?", estado);

  const prioridad = deLista(consulta.prioridad, "prioridad", PRIORIDADES);
  if (prioridad) agregar("prioridad = ?", prioridad);

  return { condiciones, params };
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
     * dentro de cada prioridad, del más nuevo al más antiguo. TDSI-674: con filtros combinables.
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

    /**
     * TDSI-209: historial de incidencias de un usuario, del más reciente al más antiguo,
     * con fecha, estado y solución. "usuario" es el usuario afectado tal como se registró
     * (correo o nombre); se compara sin distinguir mayúsculas.
     */
    async historialPorUsuario(consulta = {}) {
      const usuario = texto(consulta.usuario, "usuario", { requerido: true });
      const { total, filas } = await repo.historialPorUsuario(usuario);
      const abiertos = filas.filter((f) => !ESTADOS_FINALES.includes(f.estado)).length;
      return {
        data: filas,
        resumen: {
          usuario,
          total,
          abiertos,
          resueltos: filas.filter((f) => ESTADOS_FINALES.includes(f.estado)).length,
          mostrados: filas.length,
        },
      };
    },

    /** TDSI-209: usuarios que tienen incidentes, para el buscador del historial. */
    async usuariosConIncidentes(consulta = {}) {
      const q = texto(consulta.q, "q");
      return repo.usuariosConIncidentes(q ? paraLike(q) : null);
    },
  };
}

module.exports = { crearTicketsService, construirFiltros, texto, deLista, TIPOS, PRIORIDADES, ESTADOS, REFERENCIAS, LIMITE_MAXIMO };
