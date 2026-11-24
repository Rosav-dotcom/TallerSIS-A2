// TDSI-82: sucursales para el filtro del reporte. La empresa tiene una sola (igual que
// facturacion/src/config/sucursal.js y el tablero de gestion_pagos): no hay HU que pida gestionar
// varias sucursales aun, asi que todas las devoluciones son de esta.
const SUCURSALES = ["Sucursal Central"];

module.exports = { SUCURSALES, SUCURSAL_POR_DEFECTO: SUCURSALES[0] };
