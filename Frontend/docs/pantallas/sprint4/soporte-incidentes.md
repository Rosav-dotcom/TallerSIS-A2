# Soporte: bandeja y detalle de incidentes

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/soporte/incidentes` y `/soporte/incidentes/:numero` · carpeta `src/modules/soporte/` |
| **Backend** | `soporte` (`/api/soporte/tickets`: crear, listar con filtros y paginación, tipo, prioridad, estado, comentarios, solución, escalamiento). |
| **Figma** | p.3 (tabla, chips de estado y "02 / Prioridad") · p.2 (campos, área de texto 0/300) · p.4 (diálogos, "06 / Trazabilidad") · p.5 (estado vacío) · p.57 (botón "Nuevo usuario") |

## Historias

- **TDSI-66** · Como Usuario de Soporte, quiero registrar tickets, consultarlos y buscarlos en la bandeja, y ver el historial de incidencias de cada usuario
- **TDSI-64** · Como Usuario de Soporte, quiero gestionar cada ticket con su tipo, prioridad, estado y comentarios, y registrar la solución aplicada
- **TDSI-65** · Como Usuario de Soporte, quiero escalar un incidente a un administrador cuando no pueda resolverlo

## Dónde va cada bloque

- **Bandeja:** título "Incidentes" con botón primario "Nuevo ticket" a la derecha. Barra de filtros: buscador, número, usuario, rango de fechas, estado y prioridad.
- **Tabla:** número · tipo · usuario · fecha · `ChipPrioridad` · `Chip` de estado (Escalado, Resuelto…) · "Ver detalle". Sin resultados: `EstadoVacio`.
- **Nuevo ticket:** `Modal` o panel con tipo, prioridad, referencia y descripción.
- **Detalle · encabezado:** número y `Chip` de estado; a la derecha, selector de estado y botón contorno "Escalar a administrador" (abre `Modal` con motivo obligatorio).
- **Detalle · columna izquierda:** selectores Tipo y Prioridad, tarjeta "Solución aplicada" (`AreaTexto` 0/300 + "Marcar como resuelto") y, debajo, comentarios con autor y fecha + "Comentar".
- **Detalle · columna derecha:** `LineaTiempo` con los cambios de estado.
- **Al escalar:** `Aviso` de éxito arriba a la derecha.

## Componentes a usar

- `Tabla`, `Chip`, `ChipPrioridad`
- `CampoTexto`, `Selector`, `AreaTexto`
- `Modal`
- `Tarjeta`, `LineaTiempo`
- `Boton`
- `Aviso`
- `EstadoVacio` / `EstadoCargando` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-669 | TDSI-66 | Crear el formulario "Nuevo ticket" en la bandeja de Incidentes | 2 h | Sebastian |
| TDSI-672 | TDSI-66 | Crear la bandeja "Incidentes" con la tabla de tickets | 1.5 h | Sebastian |
| TDSI-675 | TDSI-66 | Agregar la barra de filtros a la bandeja de Incidentes | 1.5 h | Sebastian |
| TDSI-206 | TDSI-64 | Crear el formulario de solución en el detalle del incidente | 1.5 h | Sebastian |
| TDSI-678 | TDSI-64 | Agregar el selector de tipo en el formulario y en el detalle del ticket | 1 h | Sebastian |
| TDSI-681 | TDSI-64 | Agregar el selector de prioridad con los chips Baja, Media, Alta y Crítica | 1 h | Sebastian |
| TDSI-709 | TDSI-64 | Agregar el selector de estado y la línea de tiempo de cambios en el detalle | 1.5 h | Sebastian |
| TDSI-969 | TDSI-64 | Agregar la sección de comentarios en el detalle del ticket | 1.5 h | Sebastian |
| TDSI-208 | TDSI-65 | Crear el botón "Escalar a administrador" y el modal de motivo en el detalle del incidente | 1 h | Sebastian |
| TDSI-1094 | TDSI-65 | Mostrar el chip "Escalado" en la lista de incidentes y el aviso de éxito al escalar | 0.5 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-66) Un cajero que abre una ruta de Soporte tiene que ser enviado a su pantalla de inicio
- [ ] (TDSI-66) Al guardar un ticket completo, tiene que aparecer en la bandeja como Abierto con su número
- [ ] (TDSI-66) Al filtrar por prioridad Alta se tienen que ver solo esos tickets
- [ ] (TDSI-66) Al elegir un usuario se tienen que listar solo sus incidentes
- [ ] (TDSI-64) Al poner prioridad Crítica, el chip tiene que verse con el estilo de Crítica
- [ ] (TDSI-64) El selector tiene que mostrar solo los 5 tipos
- [ ] (TDSI-64) Al comentar, el comentario tiene que aparecer con autor y fecha
- [ ] (TDSI-64) Sin solución no se tiene que poder marcar como Resuelto
- [ ] (TDSI-65) Sin motivo no se tiene que poder escalar
- [ ] (TDSI-65) El incidente escalado tiene que pasar a Escalado
- [ ] (TDSI-65) El administrador tiene que verlo en su bandeja

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-209 (TDSI-66): Crear el endpoint de historial de incidentes por usuario
- TDSI-665 (TDSI-66): Crear el middleware de rol del microservicio Soporte que solo acepta al Usuario de Soporte y al Administrador
- TDSI-668 (TDSI-66): Crear POST /api/soporte/tickets con número correlativo y estado inicial Abierto
- TDSI-671 (TDSI-66): Crear GET /api/soporte/tickets con paginación
- TDSI-674 (TDSI-66): Agregar los filtros número, usuario, fechas, estado y prioridad a GET /api/soporte/tickets
- TDSI-205 (TDSI-64): Crear el endpoint para registrar la solución y marcar el incidente como Resuelto
- TDSI-677 (TDSI-64): Crear el catálogo de tipos y el endpoint para cambiar el tipo de un ticket
- TDSI-680 (TDSI-64): Crear el endpoint para cambiar la prioridad y registrar el cambio
- TDSI-693 (TDSI-64): Crear el endpoint de cambio de estado con las reglas de transición y su historial
- TDSI-968 (TDSI-64): Crear los endpoints para agregar y listar comentarios de un ticket
- TDSI-207 (TDSI-65): Crear el endpoint de escalamiento con motivo obligatorio
- TDSI-1072 (TDSI-65): Crear el endpoint de consulta de incidentes escalados para el administrador
- TDSI-1092 (TDSI-65): Registrar en el historial del incidente quién escaló, cuándo y el motivo

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
