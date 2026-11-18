# Soporte: buscar factura o pago

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/soporte` · carpeta `src/modules/soporte/` |
| **Backend** | `soporte` (nuevo, TDSI-203): endpoints de solo lectura que leen Facturación y Gestión de pagos y marcan las diferencias. |
| **Figma** | p.2 (buscador "Factura o NIT" con escáner) · p.4 (alerta "Revisión pendiente", diálogo "Detalle del pago", "06 / Trazabilidad") · p.3 (chips) |

## Historias

- **TDSI-63** · Como Usuario de Soporte, quiero consultar las facturas y pagos reclamados e identificar sus errores o inconsistencias

## Dónde va cada bloque

- **Arriba:** buscador por factura o transacción.
- **Dos tarjetas en columnas:** **Factura** (solo lectura, estilo "Detalle del pago", sin botones de anular) | **Pago** (chip de estado, por ejemplo Revertido, e historial con `LineaTiempo`).
- **Diferencias:** `Alerta` advertencia "Revisión pendiente" marcando qué no coincide.
- **Acción:** botón primario "Registrar incidente" abajo a la derecha; abre el formulario de ticket.

## Componentes a usar

- `CampoTexto` (buscador)
- `Tarjeta`, `Chip`, `LineaTiempo`
- `Alerta`
- `Boton`
- `EstadoVacio` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-204 | TDSI-63 | Crear la pantalla "Soporte" con buscador por factura o transacción y la comparación de datos | 3 h | Sebastian |
| TDSI-1065 | TDSI-63 | Crear la vista de solo lectura de la factura dentro de Soporte | 1.5 h | Sebastian |
| TDSI-1067 | TDSI-63 | Crear la vista de solo lectura de la transacción dentro de Soporte | 1.5 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-63) Al buscar una factura se tiene que mostrar junto a su pago
- [ ] (TDSI-63) Si el monto de la factura y el del pago no coinciden se tiene que marcar la diferencia
- [ ] (TDSI-63) El hallazgo se tiene que poder guardar como incidente
- [ ] (TDSI-63) Una transacción revertida tiene que mostrar el chip Revertido

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-203 (TDSI-63): Crear el microservicio soporte (Express, PostgreSQL, .env.example) y agregarlo a docker-compose
- TDSI-971 (TDSI-63): Crear el esquema soporte con la tabla de incidentes (tipo, referencia, descripción, estado, prioridad, usuario, fechas)
- TDSI-972 (TDSI-63): Comparar la factura y la transacción obtenidas por los endpoints de solo lectura y marcar las diferencias
- TDSI-1064 (TDSI-63): Crear en Soporte el endpoint de solo lectura que obtiene la factura desde Facturación
- TDSI-1066 (TDSI-63): Crear en Soporte el endpoint de solo lectura que obtiene la transacción desde Gestión de pagos

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- Soporte **solo lee**: estas pantallas nunca anulan ni modifican facturas o pagos.
