# Devoluciones: lista y detalle

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Aylen Claros (Equipo 1) |
| **Ruta y carpeta** | `/devoluciones` y `/devoluciones/:codigo` · carpeta `src/modules/devoluciones/` |
| **Backend** | `devoluciones_reembolsos` (lista, detalle, rechazo, historial, reenvío a Inventario) · `facturacion` (estado de la nota de crédito y su envío a Contabilidad). |
| **Figma** | p.3 (tabla de operaciones, chips) · p.17 (tabla de transacciones) · p.4 ("06 / Trazabilidad", diálogos, notificaciones) · p.39 (columna Contabilidad de "Diferencias de caja") · p.57 (botón "Nuevo usuario") |

## Historias

- **TDSI-70** · Como Encargado de Devoluciones, quiero registrar devoluciones totales o parciales eligiendo los ítems y cantidades
- **TDSI-76** · Como Encargado de Devoluciones, quiero que cada devolución reciba un identificador único correlativo
- **TDSI-77** · (SI-I) Como Encargado de Devoluciones, quiero que al procesar una devolución se notifique a Inventario para reingresar o dar de baja el producto
- **TDSI-78** · Como Encargado de Devoluciones, quiero rechazar una solicitud de devolución no procedente indicando el motivo
- **TDSI-81** · Como Encargado de Devoluciones, quiero consultar el registro histórico inmutable de cada devolución
- **TDSI-73** · (SI-I) Como Encargado de Devoluciones, quiero generar y emitir notas de crédito electrónicas vinculadas a la factura original
- **TDSI-71** · Como Encargado de Devoluciones, quiero elegir un motivo predefinido y escribir observaciones al registrar una devolución

## Dónde va cada bloque

- **Lista:** título "Devoluciones" con botón primario "Nueva devolución" a la derecha. Barra: buscador "Buscar por código DEV-…" a la izquierda; filtros "Estado" y rango de fechas a la derecha.
- **Tabla:** Código (con ícono de copiar) · Factura · Cliente · Fecha · Importe (`ui-num`) · Tipo (Total/Parcial) · Estado · Inventario (chip Pendiente / Enviado / Confirmado / Rechazado / Error) · Correo · "Ver detalle".
- **Detalle · encabezado:** código DEV-… con su `Chip` de estado; a la derecha, botón peligro "Rechazar devolución" (se oculta si ya fue procesada).
- **Detalle · columna izquierda:** comprobante e ítems, fila "Motivo" con chip y observaciones; tarjeta **Nota de crédito** ("Ver PDF", línea "Contabilidad" con chip Enviado / Aceptado / Rechazado / Error, N.º de asiento y "Reenviar" secundario si falla); tarjeta **Aviso a Inventario** con "Reenviar".
- **Detalle · columna derecha:** `LineaTiempo` (hora · acción, y "por Usuario · dd/mm hh:mm" en gris), sin edición, incluida la autorización del supervisor. Debajo, enlaces "Ver comprobante de reembolso" y "Ver vale".
- **Rechazo:** `Modal` de confirmación peligrosa con `AreaTexto` del motivo (obligatorio) y botón peligro "Sí, rechazar". Luego, chip **RECHAZADA** y bloque "Motivo del rechazo".

## Componentes a usar

- `Tabla`, `Chip`
- `CampoTexto` (buscador), `Selector`
- `Tarjeta`
- `LineaTiempo`
- `Modal`, `AreaTexto`
- `Boton` (peligro, secundario, contorno)
- `Aviso` (error al reenviar)
- `EstadoVacio` / `EstadoCargando` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-1005 | TDSI-70 | Crear la lista de devoluciones con filtros por estado y fecha | 2 h | Aylen |
| TDSI-1114 | TDSI-76 | Mostrar el código DEV- en la lista de devoluciones con el botón copiar | 0.5 h | Aylen |
| TDSI-1115 | TDSI-76 | Agregar la búsqueda por código DEV- en el buscador de la lista | 0.5 h | Aylen |
| TDSI-232 | TDSI-77 | Crear la condición por ítem y la columna "Inventario" con estado y botón "Reenviar" | 2 h | Aylen |
| TDSI-234 | TDSI-78 | Crear el botón "Rechazar" y el formulario de motivo | 1 h | Aylen |
| TDSI-1119 | TDSI-78 | Mostrar el chip RECHAZADA y el motivo en el detalle y en la lista | 0.5 h | Aylen |
| TDSI-1120 | TDSI-78 | Pedir confirmación antes de rechazar y ocultar el botón en devoluciones procesadas | 0.5 h | Aylen |
| TDSI-240 | TDSI-81 | Crear la línea de tiempo de estados en el detalle | 1 h | Aylen |
| TDSI-1087 | TDSI-81 | Agregar en la línea de tiempo los enlaces a Comprobante de reembolso y Vale | 0.5 h | Aylen |
| TDSI-1126 | TDSI-81 | Mostrar usuario y hora en cada punto de la línea de tiempo | 0.5 h | Aylen |
| TDSI-1021 | TDSI-73 | Mostrar en la tarjeta Nota de crédito el estado del envío a Contabilidad, el N.º de asiento y el botón Reenviar | 1 h | Aylen |
| TDSI-1105 | TDSI-71 | Mostrar el motivo y las observaciones en el resumen final y en el detalle | 0.5 h | Aylen |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-76) Cada devolución tiene que mostrar su código DEV-
- [ ] (TDSI-76) Dos devoluciones seguidas tienen que tener códigos consecutivos
- [ ] (TDSI-76) El código no se tiene que poder editar
- [ ] (TDSI-77) Al procesar una devolución la columna Inventario tiene que pasar a Enviado
- [ ] (TDSI-77) Al llegar el acuse tiene que pasar a Confirmado
- [ ] (TDSI-77) Si Inventario rechaza se tiene que ver el motivo y el botón Reenviar
- [ ] (TDSI-77) Al presionar Reenviar se tiene que volver a enviar el aviso y actualizar el estado
- [ ] (TDSI-78) Sin motivo no se tiene que poder rechazar
- [ ] (TDSI-78) La devolución rechazada tiene que mostrarse como RECHAZADA con su motivo
- [ ] (TDSI-78) Una devolución rechazada no tiene que generar reembolso ni aviso a Inventario
- [ ] (TDSI-81) Cada cambio de estado tiene que aparecer con usuario y hora
- [ ] (TDSI-81) El historial no se tiene que poder editar ni borrar
- [ ] (TDSI-81) La línea de tiempo tiene que estar en orden cronológico
- [ ] (TDSI-73) La nota de crédito tiene que mostrar la factura original a la que pertenece
- [ ] (TDSI-73) No se tiene que poder emitir por más del total de la factura
- [ ] (TDSI-73) Se tiene que poder descargar en PDF
- [ ] (TDSI-73) Al emitir la nota de crédito, la tarjeta tiene que mostrar "Enviado a Contabilidad" y luego "Aceptado" con el N.º de asiento
- [ ] (TDSI-80) El detalle tiene que mostrar qué supervisor autorizó

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-217 (TDSI-70): Corregir script_devoluciones.sql (código de producto, condición REINGRESO/MERMA y opción VALE)
- TDSI-1001 (TDSI-70): Crear el endpoint de registro con ítems y cantidades validando lo comprado y lo ya devuelto
- TDSI-229 (TDSI-76): Crear la secuencia y generar el código DEV-NNNNNN al registrar
- TDSI-1111 (TDSI-76): Agregar la restricción única y no editable al código de la devolución
- TDSI-1112 (TDSI-76): Permitir buscar una devolución por su código DEV-
- TDSI-231 (TDSI-77): Publicar el mensaje devolucion_stock en Pub/Sub con referencia DEV-<código>
- TDSI-1039 (TDSI-77): Crear la tabla de envíos y el worker de reintentos (máximo 5, luego Error)
- TDSI-1040 (TDSI-77): Leer los acuses de Inventario y actualizar el estado
- TDSI-1041 (TDSI-77): Crear el endpoint para reenviar a Inventario
- TDSI-233 (TDSI-78): Crear el endpoint de rechazo con motivo obligatorio
- TDSI-1116 (TDSI-78): Validar que no se pueda rechazar una devolución ya procesada (con reembolso emitido)
- TDSI-1117 (TDSI-78): Registrar el rechazo en el historial con usuario, hora y motivo
- TDSI-239 (TDSI-81): Crear el trigger que impide editar o borrar el historial
- TDSI-1057 (TDSI-81): Registrar cada cambio de estado y crear el endpoint de historial
- TDSI-1124 (TDSI-81): Crear la tabla de historial (estado anterior, estado nuevo, usuario, fecha)
- TDSI-223 (TDSI-73): Crear la tabla de notas de crédito en Facturación
- TDSI-1016 (TDSI-73): Crear el endpoint que emite la nota de crédito vinculada a la factura y genera su PDF con el mismo formato que la factura (TDSI-13)
- TDSI-1018 (TDSI-73): Publicar la nota de crédito en el tópico de Contabilidad (tipo nota_credito, referencia NC-<número>), reutilizando el publicador y los reintentos de Facturación (TDSI-52)
- TDSI-1019 (TDSI-73): Leer el acuse de Contabilidad (resultado y numero_asiento) y actualizar el estado del envío de la nota de crédito
- TDSI-219 (TDSI-71): Cargar los motivos: Producto vencido, Empaque dañado, Error de cobro, Cambio de producto
- TDSI-1009 (TDSI-71): Validar el motivo obligatorio y las observaciones de hasta 300 caracteres
- TDSI-1102 (TDSI-71): Crear el endpoint que lista los motivos de devolución activos
- TDSI-1103 (TDSI-71): Guardar el motivo y las observaciones en la devolución y devolverlos en el detalle

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- El historial es **inmutable**: la línea de tiempo no tiene botones de editar ni borrar.
