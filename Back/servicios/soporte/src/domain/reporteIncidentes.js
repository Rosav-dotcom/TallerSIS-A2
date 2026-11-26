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

/** TDSI-211: total de incidentes del rango y cuántos hay en cada estado y en cada prioridad. */
function calcularReporte(filas = []) {
  return {
    total: filas.length,
    por_estado: contarPor(filas, "estado", ESTADOS),
    por_prioridad: contarPor(filas, "prioridad", PRIORIDADES),
  };
}

module.exports = { calcularReporte, contarPor };
