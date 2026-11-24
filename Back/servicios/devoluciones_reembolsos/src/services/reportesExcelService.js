const ExcelJS = require("exceljs");

// TDSI-82/1088: Excel del reporte con las hojas "Devoluciones" y "Notas de crédito" (mismo
// enfoque que el Libro de Ventas de gestion_pagos, TDSI-50). Cada hoja lleva arriba el periodo y
// los filtros aplicados (PA TDSI-1061), la tabla con autofiltro y el pie con los totales.
const OFFSET_BOLIVIA_MS = 4 * 60 * 60 * 1000; // America/La_Paz es UTC-4 todo el año
const FORMATO_FECHA = "dd/mm/yyyy hh:mm";
const FORMATO_MONTO = "#,##0.00";
const FILA_ENCABEZADO = 6;

/**
 * Excel guarda fechas sin zona: se escribe la hora de Bolivia (no la UTC) para que la celda
 * muestre la misma hora que la pantalla y se pueda ordenar y filtrar como fecha.
 */
const fechaBolivia = (valor) => (valor ? new Date(new Date(valor).getTime() - OFFSET_BOLIVIA_MS) : null);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const diaTexto = (dia) => dia.split("-").reverse().join("/"); // AAAA-MM-DD -> DD/MM/AAAA
const ahoraTexto = () =>
  new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "short", timeStyle: "short" }).format(new Date());

const COLUMNAS_DEVOLUCIONES = [
  { header: "Código", key: "codigo", width: 14 },
  { header: "Fecha", key: "fecha", width: 17, fecha: true },
  { header: "Factura", key: "factura_numero", width: 14 },
  { header: "NIT/CI cliente", key: "cliente_nit", width: 15 },
  { header: "Tipo", key: "tipo", width: 10 },
  { header: "Motivo", key: "motivo", width: 22 },
  { header: "Estado", key: "estado", width: 12 },
  { header: "Motivo del rechazo", key: "motivo_rechazo", width: 28 },
  { header: "Método de pago original", key: "metodo_pago_original", width: 24 },
  { header: "Método de reembolso", key: "metodo_reembolso", width: 28 },
  { header: "Monto (Bs)", key: "monto_total", width: 13, monto: true },
  { header: "Sucursal", key: "sucursal", width: 17 },
  { header: "Caja", key: "caja_id", width: 10 },
  { header: "Nota de crédito", key: "nota_credito", width: 15 },
  { header: "Registrada por", key: "registrado_por", width: 22 },
  { header: "Autorizada por", key: "autorizado_por", width: 22 },
];

const COLUMNAS_NOTAS = [
  { header: "N° Nota de crédito", key: "numero", width: 18 },
  { header: "Fecha de emisión", key: "fecha", width: 17, fecha: true },
  { header: "Devolución", key: "devolucion_codigo", width: 14 },
  { header: "Factura", key: "factura_numero", width: 14 },
  { header: "NIT/CI cliente", key: "cliente_nit", width: 15 },
  { header: "Motivo", key: "motivo", width: 22 },
  { header: "Método de reembolso", key: "metodo_reembolso", width: 28 },
  { header: "Monto (Bs)", key: "monto", width: 13, monto: true },
  { header: "Estado", key: "estado", width: 11 },
  { header: "Enviada por correo", key: "enviada_por_correo", width: 18 },
];

/** "Estado: Todos · Motivo: Producto vencido · Método de reembolso: Vale" */
function textoFiltros(f) {
  return [
    `Estado: ${f.estado || "Todos"}`,
    `Motivo: ${f.motivo ? f.motivo.nombre : "Todos"}`,
    `Método de reembolso: ${f.metodo_reembolso ? f.metodo_reembolso.nombre : "Todos"}`,
  ].join(" · ");
}

/** Hoja con encabezado (titulo, periodo, filtros), tabla y pie de totales. */
function agregarHoja(libro, { nombre, titulo, columnas, filas, filtros, vacia, pie }) {
  const hoja = libro.addWorksheet(nombre, {
    views: [{ state: "frozen", ySplit: FILA_ENCABEZADO }],
    // impreso: horizontal y todas las columnas en el ancho de la hoja
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  hoja.columns = columnas.map(({ key, width }) => ({ key, width }));

  hoja.getCell("A1").value = `${titulo} · ${filtros.sucursal}`;
  hoja.getCell("A1").font = { bold: true, size: 14 };
  hoja.getCell("A2").value = `Periodo: ${diaTexto(filtros.desde)} al ${diaTexto(filtros.hasta)}`;
  hoja.getCell("A3").value = `Filtros: ${textoFiltros(filtros)}`;
  hoja.getCell("A4").value = `Generado: ${ahoraTexto()}`;
  hoja.getCell("A4").font = { italic: true, color: { argb: "FF666666" } };

  const encabezado = hoja.getRow(FILA_ENCABEZADO);
  encabezado.values = columnas.map((c) => c.header);
  encabezado.font = { bold: true };
  encabezado.eachCell((celda) => {
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
    celda.border = { bottom: { style: "thin" } };
  });

  let fila = FILA_ENCABEZADO;
  for (const dato of filas) {
    fila += 1;
    const valores = {};
    for (const c of columnas) {
      const v = dato[c.key];
      valores[c.key] = c.fecha ? fechaBolivia(v) : typeof v === "boolean" ? (v ? "Sí" : "No") : v ?? null;
    }
    hoja.getRow(fila).values = valores;
  }
  if (filas.length === 0) {
    fila += 1;
    hoja.getCell(`A${fila}`).value = vacia;
    hoja.getCell(`A${fila}`).font = { italic: true };
  } else {
    hoja.autoFilter = { from: { row: FILA_ENCABEZADO, column: 1 }, to: { row: fila, column: columnas.length } };
  }

  columnas.forEach((c, i) => {
    if (c.fecha) hoja.getColumn(i + 1).numFmt = FORMATO_FECHA;
    if (c.monto) hoja.getColumn(i + 1).numFmt = FORMATO_MONTO;
  });

  // pie: etiqueta en la columna anterior al monto, el monto en su columna
  const colMonto = columnas.findIndex((c) => c.monto) + 1;
  fila += 1;
  for (const { etiqueta, monto } of pie) {
    fila += 1;
    const r = hoja.getRow(fila);
    r.getCell(colMonto - 1).value = etiqueta;
    if (monto !== undefined) r.getCell(colMonto).value = monto;
    r.font = { bold: true };
  }
  return hoja;
}

/** TDSI-82/1088: arma el Excel del reporte (resultado de reportesService.obtenerReporte). */
async function generarReporteExcel({ filtros, devoluciones, notas_credito: notas, totales }) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Devoluciones y reembolsos";
  libro.created = new Date();

  agregarHoja(libro, {
    nombre: "Devoluciones",
    titulo: "Reporte de devoluciones",
    columnas: COLUMNAS_DEVOLUCIONES,
    filas: devoluciones,
    filtros,
    vacia: "Sin devoluciones para estos filtros.",
    pie: [
      { etiqueta: `Total: ${plural(totales.devoluciones.cantidad, "devolución", "devoluciones")}`, monto: totales.devoluciones.monto },
      {
        etiqueta: `Sin rechazadas: ${plural(totales.devoluciones.cantidad - totales.devoluciones.rechazadas, "devolución", "devoluciones")}`,
        monto: totales.devoluciones.monto_sin_rechazadas,
      },
    ],
  });
  agregarHoja(libro, {
    nombre: "Notas de crédito",
    titulo: "Reporte de notas de crédito",
    columnas: COLUMNAS_NOTAS,
    filas: notas,
    filtros,
    vacia: "Sin notas de crédito para estos filtros.",
    pie: [
      { etiqueta: `Total emitidas: ${plural(totales.notas_credito.emitidas, "nota", "notas")}`, monto: totales.notas_credito.monto_emitidas },
      { etiqueta: `Anuladas: ${plural(totales.notas_credito.anuladas, "nota", "notas")} (no suman)` },
    ],
  });
  return Buffer.from(await libro.xlsx.writeBuffer());
}

/** reporte-devoluciones-2026-11-01_2026-11-30.xlsx */
const nombreArchivo = ({ desde, hasta }) => `reporte-devoluciones-${desde}_${hasta}.xlsx`;

module.exports = { generarReporteExcel, nombreArchivo, COLUMNAS_DEVOLUCIONES, COLUMNAS_NOTAS, FILA_ENCABEZADO };
