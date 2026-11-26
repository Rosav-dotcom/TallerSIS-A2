# Contrato · Comprobante de la devolución por correo

TDSI-79. Para el **Equipo 1 (Devoluciones)**, que lo pide al terminar la devolución, y para la página **"Comprobante de reembolso"** (TDSI-236, TDSI-1084, TDSI-1123).

> **Un dato, un dueño:** el estado de cada correo lo guarda `gestion_pagos` (tabla `pagos.comprobantes_envios`). Devoluciones solo guarda el `id` del envío (TDSI-217).

| | |
|---|---|
| **Servicio** | `gestion_pagos` · puerto 4005 |
| **Base** | `/api/pagos/comprobantes` |
| **Formato** | JSON. Las respuestas siempre traen `ok`; si hay error, `mensaje` y `detalle` |
| **Depende de** | Facturación (`FACTURACION_URL`) para el PDF de la nota de crédito: `GET /api/notas-credito/:numero/pdf` (TDSI-73) |

## 1. Enviar el comprobante (Devoluciones)

`POST /api/pagos/comprobantes/reembolso` · **requiere** `Authorization: Bearer <token>` (Sistema Cliente, `POST /auth/token`).

```json
{
  "email": "cliente@correo.com",
  "devolucion_id": "DEV-000123",
  "cliente": "Ana Pérez",
  "nota_credito": "NC-000045",
  "reembolso": { "reversion_id": 17 }
}
```

`reembolso` se envía de **una** de estas formas (el monto nunca lo manda Devoluciones cuando ya existe un registro):

| Reembolso | Cuerpo | De dónde sale el monto |
|---|---|---|
| Tarjeta | `{ "reversion_id": 17 }` | `pagos.reversiones` (TDSI-74). Debe estar `CONFIRMADA`, si no → 409 |
| Vale | `{ "vale_codigo": "VAL-6VUK-2HSM" }` | `pagos.vales_compra` (TDSI-75) |
| Efectivo o QR | `{ "metodo": "Efectivo", "monto": 150.5, "referencia": "opcional" }` | El cuerpo |

`nota_credito` y `reembolso` son opcionales, pero tiene que llegar al menos uno. El `tipo` del envío queda `REEMBOLSO`, `VALE` o `NOTA_CREDITO` (solo nota, sin reembolso).

**Respuesta 201** (también si el correo falló: queda registrado en `Error` para reenviarlo):

```json
{
  "ok": true,
  "mensaje": "Comprobante enviado a cliente@correo.com",
  "data": {
    "id": 8,
    "tipo": "REEMBOLSO",
    "devolucion_id": "DEV-000123",
    "email": "cliente@correo.com",
    "nota_credito": "NC-000045",
    "estado": "Enviado",
    "simulado": false,
    "intentos": 1,
    "ultimo_error": null,
    "puede_reenviar": true,
    "creado_en": "...", "enviado_en": "...", "actualizado_en": "...",
    "comprobante": { "devolucion_id": "DEV-000123", "reembolso": { "metodo": "Tarjeta", "monto": 70, "referencia": "PSIM-..." }, "...": "..." }
  }
}
```

Si no se puede obtener el PDF de la nota de crédito, el correo **no** sale incompleto: queda en `Error` con el motivo en `ultimo_error`.

## 2. Estado y reenvío (página "Comprobante de reembolso")

| Método | Ruta | Qué devuelve |
|---|---|---|
| GET | `/envios?devolucion_id=DEV-000123&estado=Error` | `{ ok, total, data: [envío] }`, más nuevos primero |
| GET | `/envios/:id` | `{ ok, data: envío }` |
| POST | `/envios/:id/reenviar` | Cuerpo opcional `{ "email": "corregido@correo.com" }`. `{ ok, mensaje, data: envío }` con `intentos` + 1 |

Chip de la pantalla: `estado` = `Enviado` → "Enviado"; `Error` → "Error" (mostrar `ultimo_error` y el botón "Reenviar"). Mientras `puede_reenviar` sea `false` (estado `Pendiente`), el botón va deshabilitado.

## Errores

| Código | Cuándo |
|---|---|
| 400 | Correo inválido, falta `devolucion_id`, `nota_credito` sin formato `NC-000001`, método o monto inválido, nada que enviar |
| 401 | `POST /reembolso` sin token o con token vencido |
| 404 | La reversión, el vale o el envío no existen |
| 409 | La reversión no está `CONFIRMADA`; o el correo se está enviando ahora mismo (dos clics en "Reenviar") |
