# Nueva devolución (asistente de 4 pasos)

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Aylen Claros (Equipo 1) |
| **Ruta y carpeta** | `/devoluciones/nueva` · carpeta `src/modules/devoluciones/` |
| **Backend** | `devoluciones_reembolsos` (nuevo, TDSI-213). Búsqueda de comprobante reutiliza Facturación; opciones de reembolso leen `facturacion.factura_metodos_pago`; nota de crédito en `facturacion`; autorización del supervisor con el servicio de supervisores de Facturación (TDSI-55). |
| **Figma** | p.4 ("05 / Progreso", "04 / Alerta en línea") · p.7 ("Registrar cobro": contenido a la izquierda y columna "Resumen" fija a la derecha) · p.2 (campos y botones de 72 px) · p.10 (Autorización del Supervisor) · p.35 ("Cobro completado") |

## Historias

- **TDSI-68** · Como Encargado de Devoluciones, quiero buscar el comprobante de venta original por número de factura o NIT/CI
- **TDSI-69** · Como Encargado de Devoluciones, quiero que el sistema valide si la compra está dentro del plazo de devolución
- **TDSI-70** · Como Encargado de Devoluciones, quiero registrar devoluciones totales o parciales eligiendo los ítems y cantidades
- **TDSI-77** · (SI-I) Como Encargado de Devoluciones, quiero que al procesar una devolución se notifique a Inventario para reingresar o dar de baja el producto
- **TDSI-71** · Como Encargado de Devoluciones, quiero elegir un motivo predefinido y escribir observaciones al registrar una devolución
- **TDSI-72** · Como Encargado de Devoluciones, quiero que solo se habiliten las opciones de reembolso que corresponden al método de pago original
- **TDSI-80** · Como Supervisor de Caja, quiero autorizar con mi usuario y PIN las devoluciones que superan el monto límite y supervisar las devoluciones realizadas en caja
- **TDSI-73** · (SI-I) Como Encargado de Devoluciones, quiero generar y emitir notas de crédito electrónicas vinculadas a la factura original
- **TDSI-76** · Como Encargado de Devoluciones, quiero que cada devolución reciba un identificador único correlativo

## Dónde va cada bloque

- **Encabezado:** título "Nueva devolución" (`--texto-titulo-1`) y `Pasos` con Comprobante · Ítems · Motivo · Reembolso.
- **Diseño en dos columnas, como "Registrar cobro" (p.7):** contenido del paso a la izquierda; columna fija **Resumen** a la derecha (comprobante, ítems elegidos, total en vivo, chip Total/Parcial, motivo, y al final el botón principal).
- **Paso 1 · Comprobante:** buscador grande "Código de barras, N.º de factura o NIT/CI" con ícono de escáner. Debajo, la tarjeta del comprobante con sus ítems y la línea "Emitido hace N días hábiles · Límite: dd/mm/aaaa". Debajo, la alerta de plazo: "Todo en orden" (dentro) o "Revisión pendiente" (fuera, y "Continuar" deshabilitado). Si no existe o está anulado: "Comprobante no encontrado o anulado".
- **Paso 2 · Ítems:** `Tabla` con `Casilla` por ítem, cantidad a devolver, columna "Condición" (Reingreso / Merma con `Selector`) y subtotal. Abajo: "Atrás" (contorno) y "Continuar" (primario).
- **Paso 3 · Motivo:** 4 `BotonOpcion` (Producto vencido, Empaque dañado, Error de cobro, Cambio de producto). Debajo, `AreaTexto` "Observación" con contador 0/300. Error "Seleccione un motivo" bajo las tarjetas.
- **Paso 4 · Reembolso:** línea "Pagado con: Tarjeta •••• 1234" y 3 `BotonOpcion` (Efectivo, Reversión electrónica, Vale). Las no permitidas van deshabilitadas con la explicación debajo (y en `title`). Botón primario "Registrar devolución" al pie de la columna Resumen.
- **Sobre el límite:** antes de registrar, `Alerta` advertencia "Requiere autorización del Supervisor" y `Modal` de autorización (usuario + `CampoPin`) con la vista previa DEV-…, cliente e importe; estado "PIN inválido".
- **Confirmación, como "Cobro completado" (p.35):** check, código **DEV-000123**, y acciones "Emitir nota de crédito" (primario), "Generar vale" y "Enviar comprobante" (contorno).

## Componentes a usar

- `Pasos`
- `CampoTexto` con `icono={Search}` y `accion` de escáner
- `Tarjeta`
- `Alerta`
- `Tabla`, `Casilla`, `Selector`
- `BotonOpcion`
- `AreaTexto` (`maxLength={300}`)
- `Modal`, `CampoTexto`, `CampoPin`
- `Chip` (Total / Parcial)
- `Boton`
- `EstadoCargando` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-214 | TDSI-68 | Crear la pantalla "Devoluciones" con el buscador por número de factura o NIT/CI | 1.5 h | Aylen |
| TDSI-1076 | TDSI-68 | Crear la tarjeta de detalle del comprobante con sus ítems y el mensaje "Comprobante no encontrado o anulado" | 1.5 h | Aylen |
| TDSI-216 | TDSI-69 | Mostrar el aviso "Dentro de plazo / Fuera de plazo" y bloquear el botón Continuar | 1 h | Aylen |
| TDSI-1100 | TDSI-69 | Mostrar los días transcurridos y la fecha límite en la tarjeta del comprobante | 0.5 h | Aylen |
| TDSI-1101 | TDSI-69 | Conectar el aviso de plazo al endpoint con estados de carga y error | 0.5 h | Aylen |
| TDSI-218 | TDSI-70 | Crear la tabla de ítems con casilla, cantidad a devolver y total en vivo | 3 h | Aylen |
| TDSI-232 | TDSI-77 | Crear la condición por ítem y la columna "Inventario" con estado y botón "Reenviar" | 2 h | Aylen |
| TDSI-220 | TDSI-71 | Crear el selector de motivo y el campo de observaciones | 1 h | Aylen |
| TDSI-1104 | TDSI-71 | Mostrar el contador 0/300 y el error "Seleccione un motivo" | 0.5 h | Aylen |
| TDSI-222 | TDSI-72 | Crear el selector de reembolso con los botones Efectivo, Tarjeta y Vale | 1 h | Aylen |
| TDSI-1078 | TDSI-72 | Deshabilitar las opciones no permitidas y mostrar el tooltip con la explicación | 0.5 h | Aylen |
| TDSI-1108 | TDSI-72 | Mostrar el método de pago original de la compra encima del selector | 0.5 h | Aylen |
| TDSI-238 | TDSI-80 | Crear el modal de autorización con usuario y PIN | 1.5 h | Aylen |
| TDSI-224 | TDSI-73 | Crear el botón "Emitir nota de crédito" y su vista | 1.5 h | Aylen |
| TDSI-230 | TDSI-76 | Mostrar el código en la confirmación y en el detalle | 0.5 h | Aylen |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-68) Al buscar por número de factura se tiene que mostrar el comprobante con sus ítems
- [ ] (TDSI-68) Al buscar por NIT/CI se tienen que listar las compras del cliente
- [ ] (TDSI-68) Un comprobante anulado o inexistente tiene que mostrar "Comprobante no encontrado o anulado"
- [ ] (TDSI-69) Una compra dentro del plazo tiene que dejar continuar
- [ ] (TDSI-69) Una compra fuera del plazo tiene que mostrar el aviso y no dejar continuar
- [ ] (TDSI-69) Los sábados y domingos no se tienen que contar
- [ ] (TDSI-70) Al devolver todas las unidades la devolución tiene que quedar TOTAL
- [ ] (TDSI-70) Al devolver 1 de 3 unidades tiene que quedar PARCIAL con el monto correcto
- [ ] (TDSI-70) No se tiene que poder devolver más unidades de las compradas
- [ ] (TDSI-71) Sin motivo no se tiene que poder guardar
- [ ] (TDSI-71) El selector tiene que mostrar solo los 4 motivos
- [ ] (TDSI-71) Las observaciones no tienen que aceptar más de 300 caracteres
- [ ] (TDSI-72) Una compra en efectivo tiene que ofrecer Efectivo y Vale
- [ ] (TDSI-72) Una compra con tarjeta no tiene que mostrar Efectivo
- [ ] (TDSI-72) Al pasar el mouse por una opción deshabilitada se tiene que ver por qué
- [ ] (TDSI-80) Sobre el límite no se tiene que procesar sin usuario y PIN válidos
- [ ] (TDSI-80) Con PIN incorrecto se tiene que mostrar "PIN inválido"
- [ ] (TDSI-76) Cada devolución tiene que mostrar su código DEV-
- [ ] (TDSI-76) Dos devoluciones seguidas tienen que tener códigos consecutivos
- [ ] (TDSI-76) El código no se tiene que poder editar

## Backend que necesita

> **Acuerdo de equipo (un dato, un dueño):** en el paso 4 (Reembolso) y en la confirmación, la **reversión con tarjeta**, el **vale** y el **correo del comprobante** los hace **`gestion_pagos`** (TDSI-74, TDSI-75 y TDSI-79). Devoluciones llama a esos endpoints y solo guarda la referencia que devuelven (`reversion_id`, `vale_codigo`, `envio_id`); el monto, el saldo y el estado se consultan siempre en `gestion_pagos`. Las tablas `vales_compra`, `envios_pasarela` y `envios_comprobante` de `script_devoluciones.sql` se retiran o se reducen a esa referencia en TDSI-217. El contrato está en TDSI-1027.

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-213 (TDSI-68): Configurar el microservicio devoluciones_reembolsos (Express, PostgreSQL, .env.example) y agregarlo a docker-compose
- TDSI-991 (TDSI-68): Crear la búsqueda de comprobantes reutilizando la búsqueda de facturas de Facturación (TDSI-46), y agregar el código de barras
- TDSI-992 (TDSI-68): Agregar los roles Encargado de Devoluciones y Usuario de Soporte al login de administrador y a la pantalla Usuarios (TDSI-47)
- TDSI-215 (TDSI-69): Calcular los días hábiles desde la emisión y compararlos con el plazo configurable
- TDSI-1097 (TDSI-69): Guardar el plazo de devolución en días hábiles como configuración (por defecto 7)
- TDSI-1098 (TDSI-69): Crear el endpoint que indica si el comprobante está en plazo y los días transcurridos
- TDSI-217 (TDSI-70): Corregir script_devoluciones.sql (código de producto, condición REINGRESO/MERMA y opción VALE)
- TDSI-1001 (TDSI-70): Crear el endpoint de registro con ítems y cantidades validando lo comprado y lo ya devuelto
- TDSI-231 (TDSI-77): Publicar el mensaje devolucion_stock en Pub/Sub con referencia DEV-<código>
- TDSI-1039 (TDSI-77): Crear la tabla de envíos y el worker de reintentos (máximo 5, luego Error)
- TDSI-1040 (TDSI-77): Leer los acuses de Inventario y actualizar el estado
- TDSI-1041 (TDSI-77): Crear el endpoint para reenviar a Inventario
- TDSI-219 (TDSI-71): Cargar los motivos: Producto vencido, Empaque dañado, Error de cobro, Cambio de producto
- TDSI-1009 (TDSI-71): Validar el motivo obligatorio y las observaciones de hasta 300 caracteres
- TDSI-1102 (TDSI-71): Crear el endpoint que lista los motivos de devolución activos
- TDSI-1103 (TDSI-71): Guardar el motivo y las observaciones en la devolución y devolverlos en el detalle
- TDSI-221 (TDSI-72): Crear la tabla de reglas método de pago → opciones de reembolso
- TDSI-1077 (TDSI-72): Crear el endpoint que devuelve las opciones de reembolso habilitadas leyendo facturacion.factura_metodos_pago
- TDSI-1106 (TDSI-72): Validar al registrar que la opción de reembolso esté permitida
- TDSI-237 (TDSI-80): Validar el límite de monto que exige autorización del supervisor
- TDSI-1069 (TDSI-80): Crear en Gestión de caja el endpoint que resume las devoluciones del día por caja, leyendo Devoluciones
- TDSI-1085 (TDSI-80): Validar usuario y PIN reutilizando el servicio de supervisores de Facturación (TDSI-55) y guardar quién autorizó
- TDSI-223 (TDSI-73): Crear la tabla de notas de crédito en Facturación
- TDSI-1016 (TDSI-73): Crear el endpoint que emite la nota de crédito vinculada a la factura y genera su PDF con el mismo formato que la factura (TDSI-13)
- TDSI-1018 (TDSI-73): Publicar la nota de crédito en el tópico de Contabilidad (tipo nota_credito, referencia NC-<número>), reutilizando el publicador y los reintentos de Facturación (TDSI-52)
- TDSI-1019 (TDSI-73): Leer el acuse de Contabilidad (resultado y numero_asiento) y actualizar el estado del envío de la nota de crédito
- TDSI-229 (TDSI-76): Crear la secuencia y generar el código DEV-NNNNNN al registrar
- TDSI-1111 (TDSI-76): Agregar la restricción única y no editable al código de la devolución
- TDSI-1112 (TDSI-76): Permitir buscar una devolución por su código DEV-

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- El estado del asistente (paso actual, ítems, motivo, reembolso) vive en un hook propio, por ejemplo `src/modules/devoluciones/useNuevaDevolucion.js`. Los componentes de `ui/` solo dibujan.
- El buscador acepta el lector de código de barras: escucha `onKeyDown` con Enter.
