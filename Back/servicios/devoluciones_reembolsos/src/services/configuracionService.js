const configuracionRepo = require("../data/configuracionRepo");

// TDSI-69/1097: plazo de devolucion en dias habiles. Vive en devoluciones.configuracion
// (sql/script_devoluciones.sql) para cambiarlo sin tocar el codigo; si la fila no existe o
// tiene un valor que no sirve, se usa el de la historia: 7 dias habiles.
const CLAVE_PLAZO = "plazo_dias_habiles";
const PLAZO_POR_DEFECTO = 7;
const PLAZO_MAXIMO = 60;

async function obtenerPlazoDias() {
  const fila = await configuracionRepo.obtener(CLAVE_PLAZO);
  const valor = fila ? Number(fila.valor) : NaN;
  if (Number.isInteger(valor) && valor >= 1 && valor <= PLAZO_MAXIMO) {
    return { plazo_dias: valor, por_defecto: false, actualizado_en: fila.actualizado_en };
  }
  if (fila) console.warn(`devoluciones.configuracion: ${CLAVE_PLAZO}='${fila.valor}' no es valido, se usa ${PLAZO_POR_DEFECTO}`);
  return { plazo_dias: PLAZO_POR_DEFECTO, por_defecto: true, actualizado_en: null };
}

module.exports = { CLAVE_PLAZO, PLAZO_POR_DEFECTO, PLAZO_MAXIMO, obtenerPlazoDias };
