// TDSI-649 (TDSI-640): fórmulas de la pestaña "Ventas" del Tablero de KPIs (funciones puras,
// sin base de datos). Nombres, fórmulas y metas son los de la presentación "Tablero de KPIs
// de RePay" (Frontend/docs/pantallas/sprint4/tablero-kpis.md): se copian igual en la pantalla.
// Validación con datos reales: docs/kpis-ventas.md.

const METODOS = ["Efectivo", "Tarjeta", "QR"];

// ---------- semáforo (mismos estados que la pestaña "Caja", TDSI-639) ----------
const SEMAFORO = {
  EN_META: "En meta",
  ATENCION: "Atención",
  FUERA_DE_META: "Fuera de meta",
  REFERENCIA: "Referencia",
  SIN_DATOS: "Sin datos",
};
const semaforo = (estado) => ({ estado, texto: SEMAFORO[estado] });

/** Valor donde más es mejor: >= meta En meta, >= atencion Atención, si no Fuera de meta. */
function semaforoMayorEsMejor(valor, { meta, atencion }) {
  if (valor === null || valor === undefined) return semaforo("SIN_DATOS");
  if (valor >= meta) return semaforo("EN_META");
  return semaforo(valor >= atencion ? "ATENCION" : "FUERA_DE_META");
}

/** Valor donde menos es mejor: <= meta En meta, <= atencion Atención, si no Fuera de meta. */
function semaforoMenorEsMejor(valor, { meta, atencion }) {
  if (valor === null || valor === undefined) return semaforo("SIN_DATOS");
  if (valor <= meta) return semaforo("EN_META");
  return semaforo(valor <= atencion ? "ATENCION" : "FUERA_DE_META");
}

// ---------- formato ----------
const redondear = (n, decimales = 1) =>
  n === null || n === undefined || !Number.isFinite(Number(n)) ? null : Number(Number(n).toFixed(decimales));
const porcentaje = (parte, total) => (total > 0 ? redondear((parte / total) * 100, 1) : null);
const numeroBo = (n, decimales) =>
  new Intl.NumberFormat("es-BO", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n || 0);
const bs = (monto) => `Bs ${numeroBo(monto, 2)}`;
const pct = (n) => `${numeroBo(n, 1)} %`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Tarjeta de un KPI: siempre con su fórmula exacta y su meta (botón "Fórmula"). */
const tarjeta = ({ kpi, nombre, formula, meta }, { valor, unidad, sem, detalle, ...resto }) => ({
  kpi, nombre, formula, meta, valor, unidad, semaforo: sem, detalle, ...resto,
});

// ---------- KPI-1 Ticket promedio ----------
const KPI1 = {
  kpi: "KPI-1",
  nombre: "Ticket promedio",
  formula: "Σ monto de transacciones Registradas ÷ N.º de transacciones Registradas",
  meta: "Meta: ≥ promedio del mes anterior · Atención: baja hasta 10 % · Fuera de meta: baja más de 10 %",
};

/**
 * Una "transacción" es una venta en caja (un id_transaccion; un pago mixto cuenta una vez con
 * su total) cobrada y no anulada. Marketplace no entra (no pasa por caja).
 * actual / anterior: { cantidad, monto } del periodo y del mes anterior. porDia: [{ fecha, cantidad, monto }].
 */
function calcularTicketPromedio({ actual, anterior, porDia = [] }) {
  const valor = actual.cantidad > 0 ? redondear(actual.monto / actual.cantidad, 2) : null;
  const promedioAnterior = anterior && anterior.cantidad > 0 ? redondear(anterior.monto / anterior.cantidad, 2) : null;
  // Como en los demás KPIs, el semáforo se elige con el valor que se muestra (1 decimal)
  const variacion = valor !== null && promedioAnterior ? redondear(((valor - promedioAnterior) / promedioAnterior) * 100, 1) : null;

  let sem;
  let detalle;
  if (valor === null) {
    sem = semaforo("SIN_DATOS");
    detalle = "Sin ventas en el periodo";
  } else if (variacion === null) {
    sem = semaforo("REFERENCIA");
    detalle = "Sin ventas el mes anterior para comparar";
  } else {
    // Meta: no bajar respecto al mes anterior; Atención: baja hasta 10 %; Fuera de meta: más de 10 %
    sem = semaforoMayorEsMejor(variacion, { meta: 0, atencion: -10 });
    detalle = `${variacion >= 0 ? "▲" : "▼"} ${pct(Math.abs(variacion))} vs. mes ant.`;
  }

  return tarjeta(KPI1, {
    valor,
    unidad: "Bs",
    sem,
    detalle,
    datos: {
      transacciones: actual.cantidad,
      monto: redondear(actual.monto, 2),
      promedio_mes_anterior: promedioAnterior,
      transacciones_mes_anterior: anterior ? anterior.cantidad : 0,
      variacion_porcentaje: variacion,
    },
    por_dia: porDia.map((d) => ({
      fecha: d.fecha,
      transacciones: d.cantidad,
      monto: redondear(d.monto, 2),
      ticket_promedio: d.cantidad > 0 ? redondear(d.monto / d.cantidad, 2) : null,
    })),
  });
}

// ---------- KPI-2 Tasa de anulación por cajero ----------
const KPI2 = {
  kpi: "KPI-2",
  nombre: "Tasa de anulación por cajero",
  formula: "Facturas Anuladas ÷ Facturas emitidas × 100 · Bs anulados = Σ total anulado",
  meta: "Meta: ≤ 2 % · Atención: 2 % – 5 % · Fuera de meta: > 5 %",
};
const RANGOS_KPI2 = { meta: 2, atencion: 5 };

/**
 * En caja, cada venta cobrada emite su factura (el N° de factura es el id_transaccion, TDSI-19):
 * emitidas = cobradas + anuladas de cada cajero (las rechazadas o pendientes no emitieron).
 * porCajero: [{ cajero_id, cajero, emitidas, anuladas, monto_anulado }].
 */
function calcularTasaAnulacion({ porCajero = [] }) {
  const suma = (campo) => porCajero.reduce((t, c) => t + c[campo], 0);
  const emitidas = suma("emitidas");
  const anuladas = suma("anuladas");
  const montoAnulado = redondear(suma("monto_anulado"), 2) || 0;
  const valor = porcentaje(anuladas, emitidas);

  return tarjeta(KPI2, {
    valor,
    unidad: "%",
    sem: semaforoMenorEsMejor(valor, RANGOS_KPI2),
    detalle: emitidas === 0 ? "Sin facturas emitidas en el periodo" : `${anuladas} de ${plural(emitidas, "factura", "facturas")} · ${bs(montoAnulado)}`,
    datos: { emitidas, anuladas, monto_anulado: montoAnulado },
    por_cajero: porCajero
      .map((c) => {
        const p = porcentaje(c.anuladas, c.emitidas);
        return {
          cajero_id: c.cajero_id,
          cajero: c.cajero || c.cajero_id,
          emitidas: c.emitidas,
          anuladas: c.anuladas,
          monto_anulado: redondear(c.monto_anulado, 2) || 0,
          porcentaje: p,
          semaforo: semaforoMenorEsMejor(p, RANGOS_KPI2),
        };
      })
      .sort((a, b) => (b.porcentaje ?? -1) - (a.porcentaje ?? -1) || b.monto_anulado - a.monto_anulado || String(a.cajero).localeCompare(String(b.cajero), "es")),
  });
}

// ---------- KPI-5 Mix de métodos de pago ----------
const KPI5 = {
  kpi: "KPI-5",
  nombre: "Mix de métodos de pago",
  formula: "Σ monto del método ÷ Σ monto total cobrado × 100",
  meta: "Sin meta fija: se compara con el mes anterior · Atención: cambio > 10 puntos en un mes",
};
const CAMBIO_ATENCION = 10; // puntos porcentuales

/**
 * Porcentajes con 1 decimal que suman exactamente 100 (método del mayor resto): así la dona
 * nunca muestra 99,9 % o 100,1 % por redondeo (PA: el mix suma 100 % entre Efectivo, Tarjeta y QR).
 */
function repartirCien(montos) {
  const total = montos.reduce((a, b) => a + b, 0);
  if (total <= 0) return montos.map(() => null);
  const exactos = montos.map((m) => (m / total) * 1000); // en décimas
  const base = exactos.map(Math.floor);
  let faltan = 1000 - base.reduce((a, b) => a + b, 0);
  const orden = exactos.map((e, i) => [e - Math.floor(e), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; faltan > 0; k += 1, faltan -= 1) base[orden[k % orden.length][1]] += 1;
  return base.map((d) => d / 10);
}

/** actual / anterior: [{ metodo, monto, cantidad }] (los que falten cuentan 0). */
function calcularMixMetodos({ actual = [], anterior = [] }) {
  const monto = (lista, m) => Number((lista.find((x) => x.metodo === m) || {}).monto || 0);
  const cantidad = (lista, m) => Number((lista.find((x) => x.metodo === m) || {}).cantidad || 0);
  const pActual = repartirCien(METODOS.map((m) => monto(actual, m)));
  const pAnterior = repartirCien(METODOS.map((m) => monto(anterior, m)));

  const metodos = METODOS.map((m, i) => ({
    metodo: m,
    monto: redondear(monto(actual, m), 2),
    cantidad: cantidad(actual, m),
    porcentaje: pActual[i],
    porcentaje_mes_anterior: pAnterior[i],
    cambio_puntos: pActual[i] !== null && pAnterior[i] !== null ? redondear(pActual[i] - pAnterior[i], 1) : null,
  }));
  const total = redondear(metodos.reduce((t, m) => t + m.monto, 0), 2);
  const efectivo = metodos[0].porcentaje;
  const cambioMayor = metodos.reduce((max, m) => (m.cambio_puntos !== null && Math.abs(m.cambio_puntos) > Math.abs(max ?? 0) ? m.cambio_puntos : max), null);

  let sem;
  if (efectivo === null) sem = semaforo("SIN_DATOS");
  else if (cambioMayor !== null && Math.abs(cambioMayor) > CAMBIO_ATENCION) sem = semaforo("ATENCION");
  else sem = semaforo("REFERENCIA");

  return tarjeta(KPI5, {
    // La tarjeta del mockup es "Pago en efectivo": el valor es el % del monto cobrado en efectivo
    titulo_tarjeta: "Pago en efectivo",
    valor: efectivo,
    unidad: "%",
    sem,
    detalle: efectivo === null ? "Sin ventas cobradas en el periodo" : `QR ${pct(metodos[2].porcentaje)} · Tarjeta ${pct(metodos[1].porcentaje)}`,
    datos: { monto_total: total, cambio_mayor_puntos: cambioMayor },
    metodos,
  });
}

// ---------- KPI-6 Cumplimiento de meta de ventas ----------
const KPI6 = {
  kpi: "KPI-6",
  nombre: "Cumplimiento de meta de ventas",
  formula: "Ventas del día de la caja ÷ Meta diaria de la caja × 100",
  meta: "Meta: ≥ 100 % · Atención: 80 % – 99 % · Fuera de meta: < 80 %",
};
const RANGOS_KPI6 = { meta: 100, atencion: 80 };

/**
 * Lo lee de "Metas de venta" de Gestión de caja (GET /api/metas?fecha=, TDSI-58) para el día
 * "fecha" (el último del periodo), así cada caja coincide con esa pantalla el mismo día.
 * cajas: [{ caja_id, caja_nombre, vendido, meta, porcentaje }] tal como responde Gestión de caja
 * (meta y porcentaje "sin meta" si la caja no tiene una). error: texto si Gestión de caja no respondió.
 */
function calcularCumplimientoMeta({ fecha, cajas = [], error = null }) {
  if (error) {
    return tarjeta(KPI6, {
      valor: null, unidad: "%", sem: semaforo("SIN_DATOS"),
      detalle: "No se pudo leer Metas de venta", fecha, error, datos: null, por_caja: [],
    });
  }
  const conMeta = cajas.filter((c) => typeof c.meta === "number" && c.meta > 0);
  const vendido = redondear(conMeta.reduce((t, c) => t + Number(c.vendido || 0), 0), 2) || 0;
  const meta = redondear(conMeta.reduce((t, c) => t + c.meta, 0), 2) || 0;
  const valor = porcentaje(vendido, meta);

  return tarjeta(KPI6, {
    valor,
    unidad: "%",
    sem: semaforoMayorEsMejor(valor, RANGOS_KPI6),
    detalle: meta === 0 ? "Ninguna caja tiene meta cargada" : `${bs(vendido)} / ${numeroBo(meta, 2)}`,
    fecha,
    datos: { vendido, meta, cajas_con_meta: conMeta.length, cajas_sin_meta: cajas.length - conMeta.length },
    por_caja: cajas.map((c) => {
      const tieneMeta = typeof c.meta === "number" && c.meta > 0;
      return {
        caja_id: c.caja_id,
        caja_nombre: c.caja_nombre || c.caja_id,
        vendido: redondear(c.vendido, 2) || 0,
        meta: tieneMeta ? c.meta : null,
        // el mismo % (2 decimales) que muestra la pantalla Metas de venta
        porcentaje: tieneMeta ? (typeof c.porcentaje === "number" ? c.porcentaje : redondear((c.vendido / c.meta) * 100, 2)) : null,
        semaforo: tieneMeta ? semaforoMayorEsMejor((c.vendido / c.meta) * 100, RANGOS_KPI6) : semaforo("SIN_DATOS"),
      };
    }),
  });
}

// ---------- KPI-8 Tasa de ventas canceladas antes del cobro ----------
const KPI8 = {
  kpi: "KPI-8",
  nombre: "Tasa de ventas canceladas antes del cobro",
  formula: "Ventas canceladas ÷ (Ventas cobradas + Ventas canceladas) × 100",
  meta: "Meta: ≤ 3 % · Atención: 3 % – 6 % · Fuera de meta: > 6 %",
};
const RANGOS_KPI8 = { meta: 3, atencion: 6 };

/**
 * canceladas: [{ motivo, cantidad, monto }] de pagos.ventas_canceladas (TDSI-45).
 * cobradas: ventas cobradas en el periodo (las mismas transacciones del KPI-1).
 */
function calcularTasaCanceladas({ canceladas = [], cobradas = 0 }) {
  const cantidad = canceladas.reduce((t, c) => t + c.cantidad, 0);
  const valor = porcentaje(cantidad, cobradas + cantidad);
  const porMotivo = canceladas
    .filter((c) => c.cantidad > 0)
    .map((c) => ({ motivo: c.motivo, cantidad: c.cantidad, monto: redondear(c.monto, 2) || 0, porcentaje: porcentaje(c.cantidad, cantidad) }))
    .sort((a, b) => b.cantidad - a.cantidad || b.monto - a.monto || a.motivo.localeCompare(b.motivo, "es"));
  const masFrecuente = porMotivo[0] ? porMotivo[0].motivo : null;

  return tarjeta(KPI8, {
    valor,
    unidad: "%",
    sem: semaforoMenorEsMejor(valor, RANGOS_KPI8),
    detalle: valor === null ? "Sin ventas en el periodo" : masFrecuente ? `Motivo: ${masFrecuente}` : "Sin ventas canceladas",
    datos: {
      canceladas: cantidad,
      cobradas,
      monto_cancelado: redondear(porMotivo.reduce((t, m) => t + m.monto, 0), 2) || 0,
      motivo_mas_frecuente: masFrecuente,
    },
    por_motivo: porMotivo,
  });
}

module.exports = {
  METODOS, SEMAFORO, KPI1, KPI2, KPI5, KPI6, KPI8,
  semaforo, semaforoMayorEsMejor, semaforoMenorEsMejor, redondear, porcentaje, repartirCien, bs,
  calcularTicketPromedio, calcularTasaAnulacion, calcularMixMetodos, calcularCumplimientoMeta, calcularTasaCanceladas,
};
