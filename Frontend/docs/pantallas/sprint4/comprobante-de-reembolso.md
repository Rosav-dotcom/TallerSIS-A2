# Comprobante de reembolso

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/devoluciones/:codigo/comprobante` (se abre desde el detalle de la devolución) · carpeta `src/modules/pagos/` |
| **Backend** | `gestion_pagos` (envío y reenvío del correo, estado de la reversión con tarjeta). El PDF de la nota de crédito lo genera `facturacion` (TDSI-73, Equipo 1). |
| **Figma** | p.3 (chips) · p.2 (botón secundario olive) · p.4 (notificación "No se pudo emitir", detalle del pago) |

## Historias

- **TDSI-79** · Como Encargado de Devoluciones, quiero que el cliente reciba por correo el comprobante de la nota de crédito y del reembolso
- **TDSI-74** · Como Encargado de Devoluciones, quiero que la reversión de un pago con tarjeta se envíe automáticamente a la pasarela de pagos

## Dónde va cada bloque

- **Comprobante:** datos de la devolución, importe y forma de reembolso.
- **Correo del cliente:** al lado, chip Enviado o Error y botón secundario "Reenviar". "Reenviar" abre un `Modal` pequeño con el correo precargado para corregirlo.
- **Tarjeta "Reversión con tarjeta":** chip Enviado / Confirmado / Error y botón "Reintentar" si falla.
- **Si el envío falla:** `Aviso` tono error "No se pudo emitir".

## Componentes a usar

- `Tarjeta`, `Chip`
- `Boton` secundario
- `Modal`, `CampoTexto`
- `Aviso`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-236 | TDSI-79 | Crear la página Comprobante de reembolso | 1 h | Sebastian |
| TDSI-1084 | TDSI-79 | Mostrar el estado del correo (Enviado / Error) y el botón "Reenviar" | 0.5 h | Sebastian |
| TDSI-1123 | TDSI-79 | Permitir corregir el correo del cliente antes de reenviar | 0.5 h | Sebastian |
| TDSI-1080 | TDSI-74 | Mostrar el estado de la reversión y el botón "Reintentar" en la página Comprobante de reembolso | 1 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-79) Al terminar la devolución el cliente tiene que recibir el correo con el comprobante
- [ ] (TDSI-79) Si el envío falla se tiene que ver el error
- [ ] (TDSI-79) Se tiene que poder reenviar el correo
- [ ] (TDSI-74) Un pago con tarjeta revertido tiene que pasar a Revertido
- [ ] (TDSI-74) Un pago revertido no se tiene que sumar en los totales del día
- [ ] (TDSI-74) Si la pasarela falla se tiene que ver el estado y el reintento

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-235 (TDSI-79): Crear el envío por correo del comprobante de reembolso reutilizando el envío de facturas (TDSI-14)
- TDSI-1083 (TDSI-79): Adjuntar la nota de crédito en PDF al correo del reembolso
- TDSI-1121 (TDSI-79): Guardar el estado de cada envío y crear el endpoint de reenvío
- TDSI-1026 (TDSI-74): Crear el endpoint de reversión reutilizando la anulación de ventas (TDSI-306)
- TDSI-1079 (TDSI-74): Agregar el envío de la reversión a la pasarela (simulada) con reintentos

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- Esta página la usan los dos equipos: Equipo 2 la construye; Equipo 1 solo enlaza a ella desde el detalle.
