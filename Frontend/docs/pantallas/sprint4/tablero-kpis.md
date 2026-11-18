# Tablero de KPIs

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sección Ventas: Sebastián Orias (Equipo 2) · Sección Caja e integración: Aylen Claros (Equipo 1) |
| **Ruta y carpeta** | `/admin/kpis` (Inicio > "Tablero de KPIs") · carpeta `src/modules/kpis/` con una sección por equipo |
| **Backend** | Ventas: `gestion_pagos` (`GET /api/kpis/ventas`). Caja e integración: `gestion_caja` (turnos que cuadran, tiempo de autorización) y `facturacion` (envíos a Contabilidad). |
| **Figma** | p.17 (encabezado del Tablero de ingresos) · p.3 ("03 / Indicadores de gestión": tarjeta con valor, variación y "Fórmula") · p.5 (línea "Cobros por día", barras, dona) |

## Historias

- **TDSI-640** · Como Administrador, quiero ver en el tablero los KPIs de ventas: ticket promedio y tasa de anulación por cajero
- **TDSI-639** · Como Administrador, quiero ver en el tablero los KPIs de caja y de integración con Contabilidad

## Dónde va cada bloque

- **Encabezado:** igual al del Tablero de ingresos: título, fecha, filtros y selector de mes; botón contorno "Exportar imagen" a la derecha.
- **Sección "Ventas" (Equipo 2):** 2 `TarjetaKpi` (KPI-1 Ticket promedio, KPI-2 Tasa de anulación por cajero, en cantidad y en Bs), con la línea por día y las barras por cajero.
- **Sección "Caja e integración" (Equipo 1):** 3 `TarjetaKpi` (KPI-3 % de turnos que cuadran, KPI-4 tiempo de autorización, KPI-5 éxito de envíos a Contabilidad), dona Cuadra / Faltante / Sobrante y tendencia mensual.
- **Cada tarjeta** muestra su fórmula en el tooltip "Fórmula", con el texto exacto definido en el PowerPoint de KPIs.

## Componentes a usar

- `TarjetaKpi`
- `Selector` (mes)
- `Boton` contorno
- Gráficos con `SERIE_GRAFICO`
- `EstadoCargando` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-653 | TDSI-640 | Crear la sección "Ventas" del tablero de KPIs con tarjetas y tendencia | 2.5 h | Sebastian |
| TDSI-645 | TDSI-639 | Crear la sección "Caja e integración" del tablero de KPIs con sus tarjetas | 1.5 h | Aylen |
| TDSI-1091 | TDSI-639 | Crear los gráficos de tendencia mensual de la sección "Caja e integración" | 1 h | Aylen |
| TDSI-1131 | TDSI-639 | Agregar el selector de mes a la sección "Caja e integración" | 0.5 h | Aylen |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-640) El ticket promedio tiene que coincidir con el cálculo manual de un día
- [ ] (TDSI-640) La tasa de anulación por cajero tiene que mostrarse en cantidad y en Bs
- [ ] (TDSI-640) Al cambiar el rango de fechas se tienen que actualizar las tarjetas
- [ ] (TDSI-639) El % de turnos que cuadran tiene que coincidir con los turnos del mes
- [ ] (TDSI-639) El tiempo de autorización tiene que calcularse como resuelto menos solicitado
- [ ] (TDSI-639) El éxito de envíos tiene que coincidir con la tabla de envíos a Contabilidad

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-649 (TDSI-640): Definir y validar las fórmulas de Ticket promedio y Tasa de anulación con datos reales
- TDSI-650 (TDSI-640): Crear el endpoint GET /api/kpis/ventas en Gestión de pagos reutilizando el conteo de anuladas del historial de cajeros (TDSI-19)
- TDSI-643 (TDSI-639): Crear el endpoint del KPI % de turnos que cuadran en Gestión de caja (turnos de TDSI-31 y TDSI-60)
- TDSI-644 (TDSI-639): Crear el endpoint de KPI de envíos a Contabilidad en Facturación (factura_envios_contabilidad)
- TDSI-1090 (TDSI-639): Crear el endpoint del KPI tiempo promedio de autorización con caja.autorizaciones

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- Cada equipo trabaja en su archivo de sección (`SeccionVentas.jsx` y `SeccionCaja.jsx`) para no chocar.
- TDSI-654 (mockup) y TDSI-655 (PowerPoint) son entregables de Figma y presentación, no código.
