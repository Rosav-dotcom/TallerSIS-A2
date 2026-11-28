// TDSI-972: compara una factura (Facturación) con su transacción (Gestión de pagos)
// y marca las diferencias. Es una función pura: recibe las dos vistas de solo
// lectura que arman facturasService y transaccionesService y no hace I/O.
//
// `idBuscado` (opcional) es el ID de transacción consultado, para el mensaje si no existe.
//
// Resultado:
//   coincide     true si no hay diferencias
//   diferencias  [{ campo, factura, transaccion, mensaje }]  inconsistencias reales
//   avisos       [texto]  datos que no se pueden comparar o que conviene revisar

const TOLERANCIA = 0.01; // centavos: evita falsas diferencias por redondeo

const redondear = (n) => Math.round(Number(n) * 100) / 100;
const distintos = (a, b) => Math.abs(Number(a) - Number(b)) >= TOLERANCIA;

// "  JUAN  Pérez " -> "juan perez": compara nombres sin fijarse en mayúsculas, tildes ni espacios
function normalizarTexto(v) {
  if (v === null || v === undefined) return "";
  return String(v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Suma los montos por método (un pago mixto puede traer varias filas)
function montosPorMetodo(lista) {
  const mapa = new Map();
  for (const { metodo, monto } of lista || []) {
    mapa.set(metodo, redondear((mapa.get(metodo) || 0) + Number(monto)));
  }
  return mapa;
}

// Estado de la factura -> estado que debería tener la transacción
const ESTADO_ESPERADO = { Emitida: "Registrado", Anulada: "Anulado" };

function compararFacturaYTransaccion(factura, transaccion, { idBuscado } = {}) {
  const diferencias = [];
  const avisos = [];
  const marcar = (campo, valorFactura, valorTransaccion, mensaje) =>
    diferencias.push({ campo, factura: valorFactura, transaccion: valorTransaccion, mensaje });

  if (!factura) throw new TypeError("Se necesita la factura para comparar");

  if (!transaccion) {
    const id = idBuscado || factura.venta_id;
    marcar("transaccion", factura.venta_id ?? null, null, `La transacción ${id} no existe en Gestión de pagos`);
    return { coincide: false, diferencias, avisos };
  }

  // 1. Referencia: la factura debe apuntar a esta transacción
  if (factura.venta_id && factura.venta_id !== transaccion.id_transaccion) {
    marcar("referencia", factura.venta_id, transaccion.id_transaccion, "La factura pertenece a otra transacción");
  }

  // 2. Total facturado vs total cobrado
  if (distintos(factura.total, transaccion.total)) {
    marcar(
      "total",
      redondear(factura.total),
      redondear(transaccion.total),
      `El total facturado difiere del cobrado en Bs. ${redondear(Math.abs(factura.total - transaccion.total)).toFixed(2)}`
    );
  }

  // 3. Métodos de pago y monto por método
  const enFactura = montosPorMetodo(factura.metodos_pago);
  const enTransaccion = montosPorMetodo(transaccion.metodos);
  if (enFactura.size === 0) {
    avisos.push("La factura no registra métodos de pago; no se pudieron comparar");
  } else {
    for (const metodo of new Set([...enFactura.keys(), ...enTransaccion.keys()])) {
      const mf = enFactura.get(metodo);
      const mt = enTransaccion.get(metodo);
      if (mf === undefined) {
        marcar(`metodo_pago.${metodo}`, null, mt, `El pago con ${metodo} no figura en la factura`);
      } else if (mt === undefined) {
        marcar(`metodo_pago.${metodo}`, mf, null, `La factura indica ${metodo}, pero no hay cobro con ese método`);
      } else if (distintos(mf, mt)) {
        marcar(`metodo_pago.${metodo}`, mf, mt, `El monto pagado con ${metodo} no coincide`);
      }
    }
  }

  // 4. Cliente: NIT/CI y razón social
  const cf = factura.cliente || {};
  const ct = transaccion.cliente || {};
  const nitF = normalizarTexto(cf.nit);
  const nitT = normalizarTexto(ct.nit);
  if (nitF !== nitT) {
    marcar("cliente.nit", cf.nit ?? null, ct.nit ?? null, "El NIT/CI del cliente no coincide");
  }
  const nombreF = normalizarTexto(cf.nombre);
  const nombreT = normalizarTexto(ct.razon_social);
  if (nombreF && nombreT && nombreF !== nombreT) {
    marcar("cliente.razon_social", cf.nombre, ct.razon_social, "La razón social no coincide");
  }

  // 5. Estado de la factura vs estado del pago
  const esperado = ESTADO_ESPERADO[factura.estado];
  if (esperado && transaccion.estado !== esperado) {
    marcar(
      "estado",
      factura.estado,
      transaccion.estado,
      factura.estado === "Anulada" ? "La factura está anulada pero el pago sigue registrado" : "La factura está emitida pero el pago está anulado"
    );
  } else if (factura.estado === "AnulacionSolicitada") {
    avisos.push("La factura tiene una solicitud de anulación pendiente");
  } else if (factura.estado === "Borrador") {
    avisos.push("La factura está en borrador (todavía no se emitió)");
  }

  // 6. Resultado del cobro: una factura emitida necesita un pago aprobado
  if (factura.estado === "Emitida" && transaccion.estado_pago && transaccion.estado_pago !== "APROBADA") {
    marcar("estado_pago", factura.estado, transaccion.estado_pago, `La factura está emitida pero el pago está ${transaccion.estado_pago}`);
  }

  return { coincide: diferencias.length === 0, diferencias, avisos };
}

module.exports = { compararFacturaYTransaccion, normalizarTexto };
