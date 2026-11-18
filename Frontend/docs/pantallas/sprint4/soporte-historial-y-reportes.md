# Soporte: historial por usuario y reportes

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/soporte/historial` y `/soporte/reportes` · carpeta `src/modules/soporte/` |
| **Backend** | `soporte` (historial por usuario; reporte con totales por estado y prioridad, tiempo promedio y problemas frecuentes). |
| **Figma** | p.2 (buscador, rango de fechas) · p.3 (tabla, chips, tarjetas de indicador) · p.5 (gráficos de barras, estado vacío) |

## Historias

- **TDSI-66** · Como Usuario de Soporte, quiero registrar tickets, consultarlos y buscarlos en la bandeja, y ver el historial de incidencias de cada usuario
- **TDSI-67** · Como Usuario de Soporte, quiero generar y consultar reportes de incidencias

## Dónde va cada bloque

- **Historial por usuario:** buscador de usuario arriba y `Tabla` ordenada por fecha con chips de estado y prioridad y la solución.
- **Reportes:** rango de fechas arriba a la derecha, fila de 4 `TarjetaKpi` (totales y tiempo promedio de atención), gráfico de incidentes por estado y tabla de problemas frecuentes.

## Componentes a usar

- `CampoTexto`, `Selector`
- `Tabla`, `Chip`, `ChipPrioridad`
- `TarjetaKpi`
- Gráficos con `SERIE_GRAFICO` de `src/styles/colores.js`
- `EstadoVacio`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-210 | TDSI-66 | Crear la vista de historial con fecha, estado y solución | 1.5 h | Sebastian |
| TDSI-212 | TDSI-67 | Crear la pantalla de reportes de incidencias con selector de fechas y totales | 1 h | Sebastian |
| TDSI-1075 | TDSI-67 | Crear el gráfico de incidentes por estado y la tabla de problemas frecuentes | 1 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-67) Los totales por estado tienen que coincidir con la lista de incidentes
- [ ] (TDSI-67) El tiempo promedio de atención tiene que calcularse solo con incidentes resueltos
- [ ] (TDSI-67) Al cambiar las fechas se tiene que actualizar el reporte

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-209 (TDSI-66): Crear el endpoint de historial de incidentes por usuario
- TDSI-211 (TDSI-67): Crear el endpoint de reporte con totales por estado y prioridad
- TDSI-1074 (TDSI-67): Calcular el tiempo promedio de atención solo con incidentes resueltos
- TDSI-1095 (TDSI-67): Calcular los 5 problemas más frecuentes por categoría

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- El tiempo promedio de atención lo calcula el backend; la pantalla solo lo muestra.
