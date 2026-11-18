# Guías por pantalla

Una guía por pantalla, con su página de Figma, dónde va cada bloque, qué componentes usa, sus subtareas de Jira, sus PA y el backend que necesita.

- **Sprint 4 (pantallas nuevas):** carpeta `sprint4/`.
- **Pantallas existentes (migración del Sprint 3):** se agregan en cada fase de la migración (0005 a 0011).

## Pantallas existentes ya migradas

| Guía | Fase |
|---|---|
| [`menus.md`](menus.md) | 0005 · Menús del cajero y del administrador, interruptores y rutas por rol |
| [`acceso.md`](acceso.md) | 0006 · Login, Pantalla de bloqueo y Verificar factura |

## Antes de empezar una pantalla del Sprint 4

1. Leer `DESIGN_SYSTEM.md` y `docs/COMPONENTES.md`.
2. Abrir la guía de la pantalla y su página del Figma.
3. Crear la rama desde `migracion` (o desde `main` cuando la migración esté mezclada) con la clave de la subtarea, por ejemplo `TDSI-214-pantalla-devoluciones`.
4. Trabajar solo en la carpeta del módulo (`src/modules/devoluciones`, `src/modules/soporte`, `src/modules/pagos`, `src/modules/kpis`). Las pantallas antiguas están congeladas mientras dura la migración.
5. Antes del Pull Request: `npm run lint`, `npm run build`, las PA de la guía marcadas y captura de Figma junto a la captura real.

## Organización por equipo

| Carpeta | Equipo | Microservicio |
|---|---|---|
| `src/modules/devoluciones/` | Equipo 1 (Aylen) | `devoluciones_reembolsos` |
| `src/modules/kpis/SeccionCaja.jsx` | Equipo 1 (Aylen) | `gestion_caja`, `facturacion` |
| `src/modules/soporte/` | Equipo 2 (Orias) | `soporte` |
| `src/modules/pagos/` (vales, comprobante de reembolso) | Equipo 2 (Orias) | `gestion_pagos` |
| `src/modules/kpis/SeccionVentas.jsx` | Equipo 2 (Orias) | `gestion_pagos` |

Cada módulo tiene su `api.js` y su variable en `.env.example` (por ejemplo `VITE_DEVOLUCIONES_API_BASE_URL`), su entrada en el proxy de `vite.config.js` y su servicio en `docker-compose`. Esas tres cosas las agrega el backend del microservicio (TDSI-213 para Devoluciones y TDSI-203 para Soporte).

## Guías del Sprint 4

| Guía | Pantalla | Responsable | Historias |
|---|---|---|---|
| [`login-y-menus-por-rol.md`](sprint4/login-y-menus-por-rol.md) | Login y menús por rol | Aylen Claros (Equipo 1) · rutas de Soporte: Sebastián Orias (Equipo 2) | TDSI-68, TDSI-66 |
| [`devoluciones-nueva.md`](sprint4/devoluciones-nueva.md) | Nueva devolución (asistente de 4 pasos) | Aylen Claros (Equipo 1) | TDSI-68, TDSI-69, TDSI-70, TDSI-77, TDSI-71, TDSI-72, TDSI-80, TDSI-73, TDSI-76 |
| [`devoluciones-lista-y-detalle.md`](sprint4/devoluciones-lista-y-detalle.md) | Devoluciones: lista y detalle | Aylen Claros (Equipo 1) | TDSI-70, TDSI-76, TDSI-77, TDSI-78, TDSI-81, TDSI-73, TDSI-71 |
| [`devoluciones-reportes.md`](sprint4/devoluciones-reportes.md) | Reportes de devoluciones | Aylen Claros (Equipo 1) | TDSI-82 |
| [`vales-de-compra.md`](sprint4/vales-de-compra.md) | Vales de compra | Sebastián Orias (Equipo 2) | TDSI-75 |
| [`comprobante-de-reembolso.md`](sprint4/comprobante-de-reembolso.md) | Comprobante de reembolso | Sebastián Orias (Equipo 2) | TDSI-79, TDSI-74 |
| [`soporte-buscar-factura-o-pago.md`](sprint4/soporte-buscar-factura-o-pago.md) | Soporte: buscar factura o pago | Sebastián Orias (Equipo 2) | TDSI-63 |
| [`soporte-incidentes.md`](sprint4/soporte-incidentes.md) | Soporte: bandeja y detalle de incidentes | Sebastián Orias (Equipo 2) | TDSI-66, TDSI-64, TDSI-65 |
| [`soporte-historial-y-reportes.md`](sprint4/soporte-historial-y-reportes.md) | Soporte: historial por usuario y reportes | Sebastián Orias (Equipo 2) | TDSI-66, TDSI-67 |
| [`soporte-incidentes-escalados-admin.md`](sprint4/soporte-incidentes-escalados-admin.md) | Administrador: incidentes escalados | Sebastián Orias (Equipo 2) | TDSI-65 |
| [`tablero-pestana-devoluciones.md`](sprint4/tablero-pestana-devoluciones.md) | Tablero de ingresos: pestaña Devoluciones y chip Revertido | Aylen Claros (Equipo 1) · chip Revertido: Sebastián Orias (Equipo 2) | TDSI-80, TDSI-74 |
| [`tablero-kpis.md`](sprint4/tablero-kpis.md) | Tablero de KPIs | Sección Ventas: Sebastián Orias (Equipo 2) · Sección Caja e integración: Aylen Claros (Equipo 1) | TDSI-640, TDSI-639 |
