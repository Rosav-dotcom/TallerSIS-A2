# Tablero de KPIs

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.
> Fuente: presentación **"Tablero de KPIs de RePay · 10 indicadores"** (Sprint Planning del Sprint 4). Las fórmulas, metas y nombres de esta guía se copian **igual** en la pantalla.

| | |
|---|---|
| **Responsable** | Pestaña **Ventas**: Sebastián Orias (Equipo 2) · Pestañas **Caja** y **Devoluciones y soporte**: Aylen Claros (Equipo 1) |
| **Historias** | **TDSI-640** (Ventas: KPI-1, 2, 5, 6 y 8) · **TDSI-639** (Caja: KPI-3, 4 y 7; Devoluciones y soporte: KPI-9 y 10) |
| **Ruta y carpeta** | `/admin/kpis` (Inicio > "Tablero de KPIs") · carpeta `src/modules/kpis/` con un archivo por pestaña |
| **Interruptor** | `FEATURES.tableroKpis` en `src/config/features.js` (se enciende cuando las 3 pestañas estén probadas) |
| **Mockup** | Presentación de KPIs, p.14 (Ventas), p.15 (Caja) y p.16 (Devoluciones y soporte) |

## Los 10 KPIs

| KPI | Nombre (texto exacto) | Pestaña | Fórmula | Fuente de datos | Meta · Atención · Fuera de meta |
|---|---|---|---|---|---|
| KPI-1 | Ticket promedio | Ventas | Σ monto de transacciones Registradas ÷ N.º de transacciones Registradas | `pagos.transacciones` (monto, estado, fecha), solo ventas en caja, sin Marketplace | ≥ promedio del mes anterior · baja hasta 10 % · baja más de 10 % |
| KPI-2 | Tasa de anulación por cajero | Ventas | Facturas Anuladas ÷ Facturas emitidas × 100 · Bs anulados = Σ total anulado | `facturacion.facturas` (estado, total) y `facturacion.factura_anulaciones` (motivo, supervisor) | ≤ 2 % · 2 % – 5 % · > 5 % |
| KPI-3 | Exactitud de arqueo | Caja | Turnos CERRADOS con tipo_diferencia = CUADRA ÷ Turnos CERRADOS × 100 | `caja.turnos` (estado, diferencia, tipo_diferencia) y `caja.arqueo_denominaciones` | ≥ 95 % · 85 % – 95 % · < 85 % |
| KPI-4 | Tiempo de autorización | Caja | Promedio(resuelto_en − solicitado_en) de solicitudes APROBADAS o RECHAZADAS | `caja.autorizaciones` (tipo, solicitado_en, resuelto_en, autorizado_por) | ≤ 3 min · 3 – 10 min · > 10 min |
| KPI-5 | Mix de métodos de pago | Ventas | Σ monto del método ÷ Σ monto total cobrado × 100 | `pagos.transacciones` (metodo, monto, estado = Registrado) | Sin meta fija: se compara con el mes anterior · cambio > 10 puntos en un mes · se revisa junto a Horas pico |
| KPI-6 | Cumplimiento de meta de ventas | Ventas | Ventas del día de la caja ÷ Meta diaria de la caja × 100 | `caja.metas_venta` (caja_id, monto_meta) + ventas de los turnos del día | ≥ 100 % · 80 % – 99 % · < 80 % |
| KPI-7 | Monto de diferencias de caja | Caja | Faltante = Σ monto FALTANTE · Sobrante = Σ monto SOBRANTE · % resueltas = resueltas ÷ registradas × 100 | `caja.diferencias_resolucion` (monto, tipo, resuelta_en) | faltante ≤ Bs 100 por semana · Bs 100 – 300 · > Bs 300 o diferencias sin resolver |
| KPI-8 | **Tasa de ventas canceladas antes del cobro** | Ventas | Ventas canceladas ÷ (Ventas cobradas + Ventas canceladas) × 100, desglosado por motivo | `pagos.ventas_canceladas` (motivo, total, cajero_id, caja_id) | ≤ 3 % · 3 % – 6 % · > 6 % |
| KPI-9 | Tasa de devoluciones | Devoluciones y soporte | Σ monto devuelto (APROBADA o PROCESADA) ÷ Σ monto vendido × 100, desglosado por motivo | `devoluciones.devoluciones` (monto_total, estado, tipo, motivo_id) | ≤ 2 % · 2 % – 4 % · > 4 % |
| KPI-10 | Tiempo de resolución de soporte | Devoluciones y soporte | Promedio(fecha de resolución − fecha de registro) de tickets resueltos, por prioridad | Tabla de incidentes de Soporte (tipo, prioridad, estado, fechas) | ≤ 24 h (Crítica ≤ 4 h) · 24 – 48 h · > 48 h o Crítica > 4 h |

> **Cambio de nombre:** el KPI-8 se llama **"Tasa de ventas canceladas antes del cobro"** (antes "Ventas canceladas antes del cobro"). Usar este nombre en la tarjeta, en los títulos de los gráficos y en Jira.

## Encabezado y filtros (las 3 pestañas)

- Título **"Tablero de KPIs"** y debajo el periodo y "Todas las cajas" (o la caja elegida).
- A la derecha, tres filtros comunes: **Periodo**, **Caja** y **Cajero** (`CampoTexto` de fecha y `Selector`). Al cambiar un filtro se actualizan las tarjetas y los gráficos de la pestaña abierta.
- Pestañas con `Pestanas`: **Ventas**, **Caja** y **Devoluciones y soporte**. Cada pestaña pide sus datos solo cuando se abre, igual que el Tablero de ingresos.

## Qué muestra cada pestaña

### Ventas (TDSI-640 · Equipo 2) — `src/modules/kpis/SeccionVentas.jsx`

- **5 `TarjetaKpi`:** KPI-1 Ticket promedio, KPI-2 Tasa de anulación, KPI-5 Pago en efectivo, KPI-6 Meta de ventas y KPI-8 Tasa de ventas canceladas antes del cobro.
- Cada tarjeta lleva el valor, el estado del semáforo como `Chip` (**En meta**, **Atención**, **Fuera de meta** o **Referencia**) y un detalle corto. Ejemplos del mockup: "▲ 4,2 % vs. mes ant.", "6 de 326 facturas", "QR 30 % · Tarjeta 25 %", "Bs 126.850 / 138.000", "Motivo: cliente desistió".
- **Gráficos:** KPI-1 Ticket promedio por día (línea, Bs) · KPI-2 Anulación por cajero (barras horizontales, %) · KPI-5 Métodos de pago (dona, % del monto).

### Caja (TDSI-639 · Equipo 1) — `src/modules/kpis/SeccionCaja.jsx`

- **3 `TarjetaKpi`:** KPI-3 Exactitud de arqueo ("3 turnos con faltante"), KPI-4 Tiempo de autorización ("41 solicitudes resueltas") y KPI-7 Diferencias de caja ("Sobrantes Bs 70,00 · 1 pendiente").
- **Gráficos:** KPI-3 % de turnos que cuadran por cajero (barras con el color del semáforo) · KPI-4 Tiempo de autorización por mes (línea, min) · KPI-7 Diferencias por caja (barras Faltante y Sobrante, Bs).

### Devoluciones y soporte (TDSI-639 · Equipo 1) — `src/modules/kpis/SeccionDevolucionesSoporte.jsx`

- **4 `TarjetaKpi`:** KPI-9 Tasa de devoluciones ("19 devoluciones"), KPI-9 Monto devuelto ("12 parciales · 7 totales"), KPI-10 Resolución de tickets ("Promedio general") y KPI-10 Tickets críticos ("Meta ≤ 4 h").
- **Gráficos:** KPI-9 Devoluciones por motivo (barras horizontales, cantidad) · KPI-10 Tiempo de resolución por prioridad (barras, h; Crítica en rojo si pasa las 4 h).
- Esta pestaña depende de los módulos de Devoluciones y Soporte del Sprint 4: si su backend todavía no responde, la pestaña muestra `EstadoError` con "Reintentar" y no inventa datos.

## Cada tarjeta

- El botón **"Fórmula"** de `TarjetaKpi` (prop `formula`) muestra la fórmula **exacta** de la tabla de arriba.
- El semáforo se calcula con los rangos de la tabla. Colores: **En meta** = `exito`, **Atención** = `advertencia`, **Fuera de meta** = `error`, **Referencia** = `neutro`.
- Los montos van con `Bs` y 2 decimales; los porcentajes con 1 decimal.

## Datos: qué ya existe y qué falta

Antes de crear un endpoint nuevo, revisar estos, que **ya existen** y sirven de base:

| KPI | Endpoint existente | Servicio |
|---|---|---|
| KPI-3 | `GET /api/caja/comparacion` (resumen: turnos, cuadran, faltantes, sobrantes) | `gestion_caja` |
| KPI-4 | `GET /api/caja/eventos-autorizacion` | `gestion_caja` |
| KPI-5 | `GET /api/pagos/metodos` (monto y cantidad por método) | `gestion_pagos` |
| KPI-6 | `GET /api/metas` (vendido, meta y porcentaje por caja) | `gestion_caja` |
| KPI-7 | `GET /api/caja/diferencias` | `gestion_caja` |
| KPI-8 | `GET /api/pagos/canceladas/conteo` (solo el conteo; falta el desglose por motivo y las ventas cobradas) | `gestion_pagos` |

Lo que falta lo arma el backend en estas subtareas (los nombres en Jira se actualizan con estos KPIs):

- **TDSI-649** (TDSI-640): definir y validar con datos reales las fórmulas de KPI-1, 2, 5, 6 y 8.
- **TDSI-650** (TDSI-640): `GET /api/kpis/ventas` en `gestion_pagos` con KPI-1, KPI-2 (reutiliza el conteo de anuladas del historial de cajeros, TDSI-19), KPI-5 y KPI-8 (con motivo).
- **TDSI-643** (TDSI-639): KPI-3 Exactitud de arqueo por cajero en `gestion_caja` (turnos de TDSI-31 y TDSI-60).
- **TDSI-1090** (TDSI-639): KPI-4 Tiempo de autorización con `caja.autorizaciones`.
- **TDSI-644** (TDSI-639): KPI-7 Monto de diferencias de caja con `caja.diferencias_resolucion` (reemplaza al antiguo "éxito de envíos a Contabilidad", que ya no es un KPI).
- **KPI-9 y KPI-10:** se calculan con los datos de Devoluciones (TDSI-70, TDSI-71, TDSI-82) y de Soporte (TDSI-64, TDSI-971), dentro de TDSI-639.

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Quién |
|---|---|---|---|
| TDSI-653 | TDSI-640 | Pestaña **Ventas**: 5 tarjetas (KPI-1, 2, 5, 6 y 8) con su fórmula y semáforo, y sus 3 gráficos | Sebastián |
| TDSI-645 | TDSI-639 | Pestañas **Caja** (KPI-3, 4 y 7) y **Devoluciones y soporte** (KPI-9 y 10): tarjetas con fórmula y semáforo | Aylen |
| TDSI-1091 | TDSI-639 | Gráficos de las pestañas Caja y Devoluciones y soporte | Aylen |
| TDSI-1131 | TDSI-639 | Filtros comunes del tablero: Periodo, Caja y Cajero | Aylen |

TDSI-654 (mockup) y TDSI-655 (presentación de KPIs) son entregables de diseño, no código.

## Pruebas de aceptación

La pantalla tiene que cumplir estas PA. Los nombres y fórmulas entre comillas se escriben **igual** en la interfaz.

**TDSI-640 · Ventas**

- [ ] El ticket promedio tiene que coincidir con el cálculo manual de un día.
- [ ] La tasa de anulación por cajero tiene que mostrarse en cantidad y en Bs.
- [ ] El mix de métodos de pago tiene que sumar 100 % entre Efectivo, Tarjeta y QR.
- [ ] El cumplimiento de meta de cada caja tiene que coincidir con la pantalla Metas de venta del mismo día.
- [ ] La tarjeta se tiene que llamar "Tasa de ventas canceladas antes del cobro" y mostrar el motivo más frecuente.
- [ ] Al cambiar el periodo, la caja o el cajero se tienen que actualizar las tarjetas.

**TDSI-639 · Caja, Devoluciones y soporte**

- [ ] La exactitud de arqueo tiene que coincidir con los turnos cerrados del periodo que cuadran.
- [ ] El tiempo de autorización tiene que calcularse como resuelto menos solicitado.
- [ ] El monto de diferencias tiene que separar faltantes y sobrantes y mostrar cuántas siguen pendientes.
- [ ] La tasa de devoluciones tiene que contar solo devoluciones APROBADAS o PROCESADAS.
- [ ] El tiempo de resolución de soporte tiene que mostrarse por prioridad y marcar en rojo las críticas de más de 4 h.

**Todas las pestañas**

- [ ] Cada tarjeta muestra su semáforo (En meta, Atención o Fuera de meta) según los rangos de esta guía.
- [ ] El botón "Fórmula" de cada tarjeta muestra la fórmula exacta.

## Reglas

- Toda llamada al backend va en `src/modules/kpis/api.js`, usando `apiFetch` de `src/api/client.js`.
- El cálculo del semáforo va en un archivo propio del módulo (por ejemplo `src/modules/kpis/semaforo.js`) para que las 3 pestañas usen los mismos rangos.
- La lógica (filtros, carga, errores) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Gráficos con `SERIE_GRAFICO` y `COLOR` de `src/styles/colores.js`; nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`, sin degradados ni sombras fuertes.
- Cada equipo trabaja solo en su archivo de pestaña (`SeccionVentas.jsx`, `SeccionCaja.jsx`, `SeccionDevolucionesSoporte.jsx`) para no chocar.
