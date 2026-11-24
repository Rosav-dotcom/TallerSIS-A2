const { query } = require("../config/db");

/** TDSI-72/221: reglas metodo de pago -> opcion de reembolso de los metodos dados. */
async function reglasDe(metodos) {
  const { rows } = await query(
    `SELECT metodo_pago, opcion, permitido, explicacion
       FROM devoluciones.reglas_reembolso WHERE metodo_pago = ANY($1)`,
    [metodos]
  );
  return rows;
}

module.exports = { reglasDe };
