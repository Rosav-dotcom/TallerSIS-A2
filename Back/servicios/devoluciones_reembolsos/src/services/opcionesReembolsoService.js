const reglasReembolsoRepo = require("../data/reglasReembolsoRepo");

// TDSI-72: opciones de reembolso del paso 4 de "Nueva devolucion", en el orden de la pantalla.
const OPCIONES = [
  { codigo: "EFECTIVO", nombre: "Efectivo" },
  { codigo: "REVERSION_TARJETA", nombre: "Reversión electrónica" },
  { codigo: "VALE", nombre: "Vale" },
];
const CODIGOS = OPCIONES.map((o) => o.codigo);
const SIN_METODO = "No se registró con qué se pagó la compra: solo se puede devolver con un vale.";

/** Metodos distintos con que se pago la factura (facturacion.factura_metodos_pago), en orden. */
function metodosDe(factura) {
  return [...new Set((factura.metodosPago || []).map((m) => String(m.metodo || "").trim()).filter(Boolean))];
}

/**
 * TDSI-72/1077: con las reglas de devoluciones.reglas_reembolso decide que opciones se habilitan.
 * - Un metodo: lo que dice su regla.
 * - Pago mixto: una opcion se habilita solo si TODOS los metodos la permiten; si no, la
 *   explicacion dice cual la bloquea (p. ej. Efectivo + Tarjeta -> solo Vale).
 * - Sin metodo registrado: solo Vale.
 * Funcion pura (sin BD), para probar las reglas directamente.
 */
function calcularOpciones(metodos, reglas) {
  const regla = (metodo, opcion) => reglas.find((r) => r.metodo_pago === metodo && r.opcion === opcion);
  const mixto = metodos.length > 1;

  return OPCIONES.map(({ codigo, nombre }) => {
    if (!metodos.length) {
      const habilitada = codigo === "VALE";
      return { codigo, nombre, habilitada, explicacion: habilitada ? null : SIN_METODO };
    }
    for (const metodo of metodos) {
      const r = regla(metodo, codigo);
      const motivo = !r
        ? `No hay una regla de reembolso para el pago con ${metodo}.`
        : r.permitido ? null : r.explicacion;
      if (motivo) {
        const explicacion = mixto ? `Pago mixto (${metodos.join(" + ")}): no se permite por la parte pagada con ${metodo}. ${motivo}` : motivo;
        return { codigo, nombre, habilitada: false, explicacion };
      }
    }
    return { codigo, nombre, habilitada: true, explicacion: null };
  });
}

/** Opciones de reembolso de una factura (con sus metodosPago de facturacion). */
async function opcionesDeFactura(factura) {
  const metodos = metodosDe(factura);
  const reglas = metodos.length ? await reglasReembolsoRepo.reglasDe(metodos) : [];
  return {
    metodo_pago: metodos.length ? metodos.join(" + ") : null,
    metodos: (factura.metodosPago || []).map((m) => ({ metodo: m.metodo, monto: Number(m.monto) })),
    opciones: calcularOpciones(metodos, reglas),
  };
}

module.exports = { OPCIONES, CODIGOS, SIN_METODO, metodosDe, calcularOpciones, opcionesDeFactura };
