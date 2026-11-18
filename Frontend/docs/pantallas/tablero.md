# Tablero de ingresos (administrador)

> Migración de la fase 0011. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Archivos** | `src/pages/TableroIngresos.jsx`, `src/pages/tablero.css` y los 8 paneles de `src/components/tablero/` (solo su `return`) |
| **Figma** | p.17 (General) · p.18 (Recaudado) · p.19 (Métodos de pago) · p.20 (Cajas) · p.21 (Monitoreo de cajeros) · p.27 (Revisión de transacciones) |
| **No se toca** | Las llamadas a la API, el tablero en vivo (Server-Sent Events) y la foto fija de fechas pasadas, el refresco cada 10 s del monitoreo, los filtros de cada panel, el reparto de porcentajes de Métodos de pago, la paginación y la revisión de transacciones, el reporte de caja y su CSV. Los gráficos (`GraficoBarras`, `GraficoArea`, `GraficoPastel`) siguen igual |

## Estructura

- Título **Tablero de ingresos** y las pestañas del sistema (`Pestanas`): General, Cajas, Cajeros, Métodos de pago, Recaudado, Comparación y Reportes. Cada pestaña pide sus datos solo cuando se abre, igual que antes.
- Cada panel empieza con su título y una línea de descripción, y sigue con los filtros en una fila (`CampoTexto`, `Selector`).
- Los totales van en tarjetas KPI (`TarjetaKpi`) de hasta 5 por fila, con el monto en 24 px.
- Gráficos, rankings y tablas van dentro de `Tarjeta`. Las tablas usan `Tabla`, con los montos alineados a la derecha.
- Los estados son chips: **Abierta / Cerrada** y **Activa / Inactiva** en Cajas; **Cuadra / Faltante / Sobrante** en Comparación y Reportes; **Sin revisar / Revisada / Observada** en la revisión.
- Los errores, los avisos y los estados vacíos son `Alerta`, con su botón **Reintentar** donde ya existía.

## Por panel

- **General:** los 5 totales históricos, las ventas de 14 días y los métodos de pago, el detalle por día (fecha, sucursal y el chip **En vivo**), los rankings y los clientes que más vienen.
- **Cajas** y **Recaudado:** una ficha por caja. Las inactivas o sin movimientos se ven en hueso.
- **Cajeros:** Monitoreo de cajeros (chip **En vivo** o **Sin conexión**, hora de actualización y una ficha por cajero con sus últimas operaciones) y Transacciones por cajero.
- **Transacciones por cajero:** al elegir un cajero se abre el `Modal` ancho con el resumen, la tabla y la paginación. **Revisar transacción** se abre encima, con Revisada u Observada y la nota. Mientras está abierta, la lista no se cierra con Escape.
- **Métodos de pago:** filtros, Monto o Cantidad, la dona con su leyenda y la tabla. Al pasar el mouse por una fila se resalta lo mismo en la dona y en la leyenda.
- **Comparación:** 4 tarjetas (Turnos, Cuadran, Faltantes y Sobrantes) y la tabla por turno, con la diferencia en rojo si falta y en ámbar si sobra.
- **Reportes:** caja y rango de fechas, **Generar reporte**, los totales, los totales por método, la tabla de turnos, las diferencias y **Descargar CSV**.

## Se corrige

- **Revisar transacción** quedaba detrás de la ventana de transacciones y no se podía usar. Ahora se abre encima.

## Pruebas después de este cambio

- [ ] General: se ven los totales, los gráficos y los rankings. Con la fecha de hoy aparece **En vivo** y, con una fecha pasada, el detalle de ese día.
- [ ] Cajas: los filtros Estado y Actividad y "Quitar filtros".
- [ ] Cajeros: el monitoreo se actualiza solo. Al elegir un cajero se abren sus transacciones; "Agregar nota" con **Observada** y sin nota muestra "La nota es obligatoria…", y con nota se guarda.
- [ ] Métodos de pago: cambiar fechas, cajero o caja, y "Monto" o "Cantidad".
- [ ] Recaudado: cambiar la fecha y volver con "Hoy".
- [ ] Comparación: filtrar por caja, cajero y diferencia.
- [ ] Reportes: generar un reporte y descargar el CSV.
