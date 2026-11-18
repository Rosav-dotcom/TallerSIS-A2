# Administrador: incidentes escalados

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/admin/soporte/escalados` · carpeta `src/modules/soporte/` |
| **Backend** | `soporte` (consulta de incidentes escalados para el administrador). |
| **Figma** | p.8 y p.75 (menú del administrador) · p.3 (tabla, chip "Escalado") |

## Historias

- **TDSI-65** · Como Usuario de Soporte, quiero escalar un incidente a un administrador cuando no pueda resolverlo

## Dónde va cada bloque

- **Menú del administrador:** Soporte > "Incidentes escalados".
- **Tabla:** número · motivo del escalamiento · quién escaló · fecha · `Chip` "Escalado" · acción "Tomar y resolver".

## Componentes a usar

- `Tabla`, `Chip`
- `Boton` fantasma o contorno en la columna Acciones
- `EstadoVacio`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-1073 | TDSI-65 | Crear la bandeja "Incidentes escalados" en el panel del administrador | 1 h | Sebastian |

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-1072 (TDSI-65): Crear el endpoint de consulta de incidentes escalados para el administrador

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- La PA relacionada ("El administrador tiene que verlo en su bandeja") está en la historia TDSI-65.
