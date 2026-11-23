// TDSI-69/215: plazo de devolucion en dias habiles (lunes a viernes; sabados y domingos no
// cuentan). El "dia" es el de Bolivia (America/La_Paz, UTC-4 todo el año), no el del
// servidor: en Docker/Supabase el servidor corre en UTC y una compra de las 21:00 seria
// "manana" si se usara la hora UTC.
//
// Regla: el dia de la compra no cuenta. Cada dia habil despues de la compra suma 1, hasta
// hoy inclusive. La compra esta dentro de plazo mientras esos dias no pasen el plazo; el
// ultimo dia permitido (fecha_limite) es el dia habil numero <plazo> despues de la compra.
//   Ej. plazo 7, compra el viernes 2026-11-20 -> lunes 23 es el dia 1 ... lunes 30 es el
//   dia 6, martes 1/12 es el dia 7 (fecha limite); el miercoles 2/12 ya esta fuera de plazo.
const ZONA = "America/La_Paz";
const DIA_MS = 24 * 60 * 60 * 1000;

/** Instante (Date, ISO o timestamp) -> dia "YYYY-MM-DD" en Bolivia. */
function diaLocal(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) throw new TypeError(`Fecha invalida: ${fecha}`);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);
}

// Los dias "YYYY-MM-DD" se manejan como medianoche UTC: sumar dias es exacto (sin horarios).
const aUtc = (dia) => new Date(`${dia}T00:00:00Z`);
const aDia = (d) => d.toISOString().slice(0, 10);
const sumarDias = (dia, n) => aDia(new Date(aUtc(dia).getTime() + n * DIA_MS));

/** Lunes a viernes. */
function esHabil(dia) {
  const semana = aUtc(dia).getUTCDay(); // 0 domingo ... 6 sabado
  return semana !== 0 && semana !== 6;
}

/** Dias habiles despues de "desde" hasta "hasta" inclusive (0 si hasta <= desde). */
function diasHabilesEntre(desde, hasta) {
  if (hasta <= desde) return 0;
  const total = Math.round((aUtc(hasta) - aUtc(desde)) / DIA_MS);
  const semanas = Math.floor(total / 7);
  let habiles = semanas * 5;
  for (let i = semanas * 7 + 1; i <= total; i++) {
    if (esHabil(sumarDias(desde, i))) habiles++;
  }
  return habiles;
}

/** El dia habil numero n despues de "dia" (n >= 1). */
function sumarDiasHabiles(dia, n) {
  let actual = dia;
  for (let contados = 0; contados < n; ) {
    actual = sumarDias(actual, 1);
    if (esHabil(actual)) contados++;
  }
  return actual;
}

/**
 * TDSI-215: dias habiles desde la emision comparados con el plazo.
 * fechaEmision: instante de la factura; plazoDias: entero >= 1; hoy: instante (por defecto ahora).
 */
function evaluarPlazo({ fechaEmision, plazoDias, hoy = new Date() }) {
  const emision = diaLocal(fechaEmision);
  const diaHoy = diaLocal(hoy);
  const transcurridos = diasHabilesEntre(emision, diaHoy);
  return {
    fecha_emision: emision,
    hoy: diaHoy,
    dias_transcurridos: transcurridos,
    plazo_dias: plazoDias,
    fecha_limite: sumarDiasHabiles(emision, plazoDias),
    dias_restantes: Math.max(plazoDias - transcurridos, 0),
    dentro_de_plazo: transcurridos <= plazoDias,
  };
}

module.exports = { ZONA, diaLocal, esHabil, diasHabilesEntre, sumarDiasHabiles, evaluarPlazo };
