# Reportes de devoluciones

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Aylen Claros (Equipo 1) |
| **Ruta y carpeta** | `/devoluciones/reportes` · carpeta `src/modules/devoluciones/` |
| **Backend** | `devoluciones_reembolsos` (reporte con filtros y Excel con hojas Devoluciones y Notas de crédito). |
| **Figma** | p.2 (selectores y rango de fechas) · p.17 (tabla) · p.51 ("Libro de Ventas": botón Exportar) · p.5 (estado vacío) |

## Historias

- **TDSI-82** · Como Encargado de Devoluciones, quiero exportar reportes periódicos de devoluciones y notas de crédito

## Dónde va cada bloque

- **Encabezado:** título "Reportes" y botón contorno "Exportar a Excel" arriba a la derecha.
- **Filtros:** sucursal, rango de fechas, estado, método de reembolso y motivo.
- **Vista previa:** `Tabla` filtrada debajo de los filtros, con importes en `ui-num`.
- **Sin resultados:** `EstadoVacio` y el botón Exportar no descarga nada.

## Componentes a usar

- `Selector`, `CampoTexto` (fechas)
- `Boton` contorno
- `Tabla`
- `EstadoVacio`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-242 | TDSI-82 | Crear los filtros de fecha, estado y motivo del reporte | 1 h | Aylen |
| TDSI-1089 | TDSI-82 | Crear el botón "Exportar" con la descarga y el aviso "Sin resultados" | 0.5 h | Aylen |
| TDSI-1129 | TDSI-82 | Mostrar la vista previa de la tabla filtrada antes de exportar | 1 h | Aylen |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-82) El Excel tiene que respetar los filtros elegidos
- [ ] (TDSI-82) Tiene que incluir devoluciones y notas de crédito
- [ ] (TDSI-82) Sin resultados se tiene que avisar y no descargar

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-241 (TDSI-82): Crear el endpoint de reporte de devoluciones y notas de crédito con filtros de fecha, estado y motivo
- TDSI-1088 (TDSI-82): Generar el Excel con las hojas Devoluciones y Notas de crédito
- TDSI-1127 (TDSI-82): Responder "Sin resultados" sin generar archivo cuando el filtro no trae datos

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
