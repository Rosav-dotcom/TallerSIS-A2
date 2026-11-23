// TDSI-1026 (TDSI-74): pasarela de pagos SIMULADA para revertir cobros con tarjeta.
// No hay una pasarela real en el proyecto: esta responde como una, con una pequeña
// demora, y puede fallar a propósito para probar los reintentos (PA TDSI-1031):
//   PASARELA_SIMULAR_FALLO=true  -> falla siempre (para mostrar el estado ERROR y "Reintentar")
//   PASARELA_TASA_FALLO=0.3      -> falla el 30 % de las veces (0 = nunca, por defecto)
// Si algún día hay una pasarela real, solo se reemplaza este archivo: el servicio de
// reversión solo usa revertir({ reversion_id, id_transaccion, monto }) -> { referencia }.

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

function crearPasarelaSimulada({
  fallarSiempre = process.env.PASARELA_SIMULAR_FALLO === "true",
  tasaFallo = Number(process.env.PASARELA_TASA_FALLO || 0),
  latenciaMs = 150,
  aleatorio = Math.random,
} = {}) {
  return {
    async revertir({ reversion_id, id_transaccion, monto }) {
      await esperar(latenciaMs);
      if (fallarSiempre || aleatorio() < tasaFallo) {
        throw new Error("La pasarela de pagos no respondió (simulado)");
      }
      // Código que devolvería la pasarela para rastrear la reversión
      const referencia = `PSR-${Date.now().toString(36).toUpperCase()}-${reversion_id}`;
      return { referencia, id_transaccion, monto };
    },
  };
}

module.exports = { crearPasarelaSimulada };
