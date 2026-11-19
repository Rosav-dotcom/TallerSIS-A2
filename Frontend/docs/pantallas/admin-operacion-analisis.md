# Administrador: Operación y Análisis

> Migración de la fase 0013. Sigue `DESIGN_SYSTEM.md`, usa los componentes de `docs/COMPONENTES.md` y las clases comunes `adm-*` de `src/pages/admin.css` (ver `admin-personas.md`).

| | |
|---|---|
| **Archivos** | `src/pages/CierreDiario.jsx`, `HistorialOperaciones.jsx`, `DiferenciasCaja.jsx`, `ComparativoMensual.jsx`, `HorasPico.jsx`, `MetasVenta.jsx`, `ProductosVendidos.jsx`, `VentasOnline.jsx` (solo su `return`) y `src/pages/admin.css` |
| **Figma** | p.75 (menú y componentes del administrador) y el sistema de diseño |
| **No se toca** | Las llamadas a la API, la generación del lote y el aviso de lote ya existente, los reenvíos a Contabilidad, el historial con eventos de autorización, el orden y la paginación, los filtros, el cálculo de horas pico y de variaciones, las metas, el envío a Compras y la aprobación del aviso al Marketplace |

## Operación

- **Cierre diario:** tarjeta "Generación de lote" con la fecha y "Generar lote". El resumen financiero muestra el estado como chip, la fecha, el identificador y 4 tarjetas KPI (ingresos, egresos, impuestos y neto). "Envíos a Contabilidad" tiene "Actualizar" y una tabla con el estado (**Enviado**, **Pendiente** o **Error**, con el detalle del error) y "Reenviar". El aviso "Ya existe un lote generado para esta fecha" es un `Modal`.
- **Historial de operaciones:** filtros en una fila (cajero, supervisor que autorizó, desde y hasta), con sus avisos debajo; resumen por día (3 tarjetas KPI y una tabla), y la tabla de operaciones con "Fecha y hora" para ordenar, el estado como chip y la paginación.
- **Diferencias de caja:** filtros Estado y Contabilidad. La tabla muestra el tipo y el estado como chips, el monto en rojo si falta y en ámbar si sobra, el estado en Contabilidad con "Reenviar" y "Resolver". "Resolver diferencia" es un `Modal` con la justificación.

## Análisis

- **Comparativo mensual:** mes y año, el aviso cuando se compara el mes en curso, 3 tarjetas KPI y las tablas por caja y por método, con la variación en verde si sube y en rojo si baja.
- **Horas pico:** fechas y caja; el gráfico por hora va dentro de una `Tarjeta`, con las 3 horas pico en dorado.
- **Metas de venta:** una ficha por caja con lo vendido, la meta, la barra de avance (verde desde 100 %, ámbar desde 50 % y roja por debajo) y "Definir meta" o "Editar meta" en un `Modal`.
- **Productos Vendidos:** fecha, "Enviar a Compras" con el estado del envío como chip, el aviso de error y la tabla con su total. La confirmación es un `Modal`.
- **Ventas Online:** filtros, la tabla con la factura, el aviso al Marketplace, la factura por correo y el estado como chips, y "Ver factura", que abre un `Modal` ancho con "Aprobar y enviar a Marketplace (Pub/Sub)" y los ítems. En esta tabla los títulos y los chips pueden ir en dos líneas para que entre completa.

## Pruebas después de este cambio

- [ ] Cierre diario: generar un lote; con una fecha ya procesada aparece "Ya existe un lote…" y "Ver lote existente" muestra el resumen. Reenviar un envío con error.
- [ ] Historial: cambiar las fechas y el cajero, ordenar por fecha y escribir un supervisor (aparece el aviso de que solo se muestran las operaciones autorizadas).
- [ ] Diferencias: resolver sin justificación muestra "La justificación es obligatoria."; con una justificación se resuelve. Reenviar a Contabilidad.
- [ ] Comparativo mensual: cambiar el mes y el año.
- [ ] Horas pico: cambiar fechas y caja.
- [ ] Metas: definir una meta (Guardar se habilita con un monto mayor a 0) y editarla.
- [ ] Productos Vendidos: enviar a Compras y ver el estado del envío.
- [ ] Ventas Online: filtrar, abrir "Ver factura" y aprobar el aviso al Marketplace.
