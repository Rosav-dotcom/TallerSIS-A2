const { AppError } = require("../utils/AppError");
const { compararFacturaYTransaccion } = require("../domain/compararFacturaYTransaccion");

// TDSI-972: obtiene la factura y la transacción por los endpoints de solo lectura
// (TDSI-1064 y TDSI-1066) y marca sus diferencias.
// Se necesita el número de factura; el ID de transacción es opcional y, si no
// llega, se usa el que guarda la factura (venta_id).
function crearComparacionService({ facturasService, transaccionesService }) {
  return {
    async comparar({ factura: numeroFactura, transaccion: idTransaccion } = {}) {
      if (!numeroFactura) {
        throw new AppError("Indique el número de factura", 400, "Parámetros: ?factura=F-000123&transaccion=TX-... (transaccion es opcional)");
      }
      const factura = await facturasService.consultarFactura(numeroFactura);

      const id = idTransaccion || factura.venta_id;
      if (!id) {
        throw new AppError("La factura no indica su transacción", 400, "Envíe también ?transaccion=<ID de transacción>");
      }

      // Si la transacción no existe es una inconsistencia que Soporte debe ver, no un error
      let transaccion = null;
      try {
        transaccion = await transaccionesService.consultarTransaccion(id);
      } catch (e) {
        if (e.status !== 404) throw e;
      }

      return { factura, transaccion, ...compararFacturaYTransaccion(factura, transaccion, { idBuscado: id }) };
    },
  };
}

module.exports = { crearComparacionService };
