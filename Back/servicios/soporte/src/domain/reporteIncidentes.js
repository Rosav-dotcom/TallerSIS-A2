// TDSI-67: cálculos del reporte de incidencias (función pura, sin base de datos).
// Recibe las filas de soporte.incidentes del rango (ya filtradas por fecha de creación,
// igual que la bandeja de tickets) y arma los números que muestra la pantalla de reportes.
const { ESTADOS, PRIORIDADES } = require("../services/ticketsService");

/** Cuenta las filas por "campo", en el orden de "valores" y con 0 en los que no aparecen. */
function contarPor(filas, campo, valores) {
  const cuenta = Object.fromEntries(valores.map((v) => [v, 0]));
  for (const f of filas) if (f[campo] in cuenta) cuenta[f[campo]] += 1;
  return valores.map((v) => ({ [campo]: v, cantidad: cuenta[v] }));
}

// TDSI-1074: solo cuentan los incidentes resueltos. resuelto_en lo pone el cambio a
// Resuelto (TDSI-64) y se borra si se reabre, así que un Cerrado que pasó por Resuelto
// también cuenta; uno abierto, en proceso, pendiente o escalado no (PA TDSI-989).
const ESTADOS_RESUELTOS = ["Resuelto", "Cerrado"];
const MINUTO_MS = 60 * 1000;

const ms = (v) => (v instanceof Date ? v.getTime() : Date.parse(v));

/** "2 d 3 h 15 min", "45 min", "menos de 1 min" */
function duracionTexto(minutos) {
  if (minutos < 1) return "menos de 1 min";
  const total = Math.round(minutos);
  const d = Math.floor(total / 1440);
  const h = Math.floor((total % 1440) / 60);
  const m = total % 60;
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}

/** Tiempo promedio desde que se registró el incidente hasta que se marcó como Resuelto. */
function tiempoPromedioAtencion(filas = []) {
  const minutos = [];
  for (const f of filas) {
    if (!ESTADOS_RESUELTOS.includes(f.estado) || !f.resuelto_en) continue;
    const duracion = ms(f.resuelto_en) - ms(f.creado_en);
    if (Number.isFinite(duracion) && duracion >= 0) minutos.push(duracion / MINUTO_MS);
  }
  if (minutos.length === 0) {
    return { incidentes_resueltos: 0, promedio_minutos: null, promedio_horas: null, texto: "Sin incidentes resueltos en el rango" };
  }
  const promedio = minutos.reduce((a, b) => a + b, 0) / minutos.length;
  return {
    incidentes_resueltos: minutos.length,
    promedio_minutos: Math.round(promedio * 10) / 10,
    promedio_horas: Math.round((promedio / 60) * 100) / 100,
    texto: duracionTexto(promedio),
  };
}

/** TDSI-211: total de incidentes del rango y cuántos hay en cada estado y en cada prioridad. */
function calcularReporte(filas = []) {
  return {
    total: filas.length,
    por_estado: contarPor(filas, "estado", ESTADOS),
    por_prioridad: contarPor(filas, "prioridad", PRIORIDADES),
    tiempo_promedio_atencion: tiempoPromedioAtencion(filas), // TDSI-1074
  };
}

module.exports = { calcularReporte, contarPor, tiempoPromedioAtencion, duracionTexto, ESTADOS_RESUELTOS };
