const { AppError } = require("../utils/AppError");

const FORMATO_ID = /^[A-Za-z0-9_-]{1,60}$/; // mismo formato que valida gestion_pagos

// TDSI-1066: consulta de solo lectura de una transacción para el Usuario de Soporte.
// Devuelve el detalle (métodos y montos) y el historial de cambios de estado.
function crearTransaccionesService({ gestionPagosClient }) {
  return {
    async consultarTransaccion(id) {
      const valor = String(id || "").trim();
      if (!FORMATO_ID.test(valor)) {
        throw new AppError("ID de transacción inválido", 400, "Solo letras, números, guion y guion bajo (máx. 60)");
      }
      const transaccion = await gestionPagosClient.obtenerTransaccion(valor);
      if (!transaccion) throw new AppError("Transacción no encontrada", 404);
      const historial = await gestionPagosClient.obtenerHistorial(valor);
      return { ...transaccion, historial };
    },
  };
}

module.exports = { crearTransaccionesService };
