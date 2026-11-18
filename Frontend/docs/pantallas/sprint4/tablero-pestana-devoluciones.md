# Tablero de ingresos: pestaña Devoluciones y chip Revertido

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Aylen Claros (Equipo 1) · chip Revertido: Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/admin/tablero` (existente) · archivo nuevo `src/components/tablero/PanelDevoluciones.jsx` |
| **Backend** | `gestion_caja` (resumen de devoluciones del día por caja, TDSI-1069) · `gestion_pagos` (estado Revertido de las transacciones). |
| **Figma** | p.17 (Tablero de ingresos y sus pestañas) · p.3 (tabla y chips) |

## Historias

- **TDSI-80** · Como Supervisor de Caja, quiero autorizar con mi usuario y PIN las devoluciones que superan el monto límite y supervisar las devoluciones realizadas en caja
- **TDSI-74** · Como Encargado de Devoluciones, quiero que la reversión de un pago con tarjeta se envíe automáticamente a la pasarela de pagos

## Dónde va cada bloque

- **Pestaña nueva "Devoluciones"** después de "Revisión de transacciones".
- **Tabla:** caja · devoluciones · monto reintegrado (`ui-num`) · método · autorizado por (supervisor), con el total por caja.
- **Revisión de transacciones (existente):** chip "Revertido" en la columna Estado.

## Componentes a usar

- `Tabla`, `Chip`
- `EstadoVacio` / `EstadoCargando` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-1070 | TDSI-80 | Crear la pestaña "Devoluciones" en el Tablero de ingresos | 1 h | Aylen |
| TDSI-1086 | TDSI-80 | Mostrar en la pestaña Devoluciones el total por caja y el supervisor que autorizó | 1 h | Aylen |
| TDSI-226 | TDSI-74 | Mostrar el chip Revertido en Revisión de transacciones | 0.5 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-80) La pestaña tiene que mostrar las devoluciones del día agrupadas por caja

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-1069 (TDSI-80): Crear en Gestión de caja el endpoint que resume las devoluciones del día por caja, leyendo Devoluciones
- TDSI-225 (TDSI-74): Agregar el estado Revertido a las transacciones y la tabla de reversiones

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- `TableroIngresos.jsx` y sus paneles se rediseñan en la fase 0010. En el Sprint 4 solo se **agrega** la pestaña nueva en su propio archivo y el chip; no reescribir los paneles existentes.
