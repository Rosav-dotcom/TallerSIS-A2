# Contrato · Reversión de pagos con tarjeta

TDSI-1027 (historia TDSI-74). Para el **Equipo 1 (Devoluciones)**: cómo pedirle a `gestion_pagos` que revierta el cobro con tarjeta de una venta, y cómo consultar el resultado.

> **Un dato, un dueño:** la reversión la hace y la guarda `gestion_pagos` (tabla `pagos.reversiones`). Devoluciones solo guarda el `id` que devuelve este servicio (`reversion_id`) y no usa `devoluciones.envios_pasarela`.

| | |
|---|---|
| **Servicio** | `gestion_pagos` · puerto 4005 (`http://gestion_pagos:4005` dentro de docker-compose) |
| **Base** | `/api/pagos/reversiones` |
| **Formato** | JSON. Las respuestas siempre traen `ok`; si hay error, `mensaje` y `detalle` |

## Resumen

| Método | Ruta | Token | Quién lo usa |
|---|---|---|---|
| POST | `/api/pagos/reversiones` | **Sí** | Backend de Devoluciones, al elegir "Reversión electrónica" en el paso 4 |
| GET | `/api/pagos/reversiones/:id` | No | Página "Comprobante de reembolso" (TDSI-1080) |
| GET | `/api/pagos/reversiones?devolucion_id=&id_transaccion=&estado=` | No | Listados y búsquedas |
| POST | `/api/pagos/reversiones/:id/reintentar` | No | Botón "Reintentar" cuando la pasarela falló |

## 1. Pedir el token (una vez cada 15 min)

Crear la reversión devuelve dinero, así que solo la puede pedir el servicio de Devoluciones. Se registra una sola vez como Sistema Cliente:

```bash
cd Back/servicios/gestion_pagos
npm run crear-cliente -- devoluciones "Devoluciones"
```

Con el `client_id` y el `client_secret` que muestra:

```http
POST /auth/token
Content-Type: application/json

{ "client_id": "devoluciones", "client_secret": "<secreto>" }
```

```json
{ "ok": true, "data": { "access_token": "eyJ...", "token_type": "Bearer", "expires_in": 900 } }
```

El token dura `expires_in` segundos. Se envía como `Authorization: Bearer <access_token>`.

## 2. Crear la reversión

```http
POST /api/pagos/reversiones
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "id_transaccion": "VTA-022675",
  "motivo": "Devolución total: producto con falla",
  "solicitado_por": "encargado.devoluciones@tallersis.bo",
  "devolucion_id": "DEV-000123"
}
```

| Campo | Obligatorio | Regla |
|---|---|---|
| `id_transaccion` | Sí | N° de la venta en `gestion_pagos` (letras, números, `-`, `_`; máx. 60) |
| `motivo` | Sí | 10 a 300 caracteres |
| `solicitado_por` | Sí | Encargado de Devoluciones que la pide (máx. 100) |
| `devolucion_id` | No | Id de la devolución en el Equipo 1, para buscarla después (máx. 60) |

**Qué se revierte:** lo pagado con **Tarjeta** de esa venta. En un pago mixto (Tarjeta + Efectivo) solo se revierte la parte con tarjeta; la otra parte se reembolsa por otro medio (efectivo o vale). Siempre es el monto completo de la tarjeta: no hay reversión parcial.

**Qué pasa al llamarlo:**
1. Se valida la venta y se guarda la reversión en `ENVIADA` (con las filas de la venta bloqueadas, igual que la anulación TDSI-306).
2. Se envía a la pasarela: hasta **3 intentos**, esperando 0,5 s y luego 1 s entre ellos.
3. Si la pasarela confirma, la reversión queda `CONFIRMADA` y las filas pagadas con tarjeta pasan a **`Revertido`**: dejan de sumar en los totales del día, el tablero y el cierre de caja.
4. Si falla los 3 intentos, queda en `ERROR` y la venta **no** cambia. Se puede reintentar (punto 4).

La respuesta llega cuando termina el envío, normalmente en menos de 1 s y como máximo en unos 2 s.

**Respuesta `201`** (se creó la reversión; mirar `data.estado`):

```json
{
  "ok": true,
  "mensaje": "Reversión confirmada por la pasarela",
  "data": {
    "id": 8,
    "id_transaccion": "VTA-022675",
    "metodo": "Tarjeta",
    "monto": 50,
    "motivo": "Devolución total: producto con falla",
    "devolucion_id": "DEV-000123",
    "solicitado_por": "encargado.devoluciones@tallersis.bo",
    "estado": "CONFIRMADA",
    "intentos": 1,
    "ultimo_error": null,
    "referencia_pasarela": "PSR-MWTHK1YT-8",
    "creado_en": "2026-11-23T16:34:08.716Z",
    "actualizado_en": "2026-11-23T16:34:09.328Z",
    "confirmado_en": "2026-11-23T16:34:09.328Z"
  }
}
```

Si la pasarela falló, también es `201`, pero con `"estado": "ERROR"`, `"intentos": 3`, `"ultimo_error": "La pasarela de pagos no respondió (simulado)"` y `"mensaje": "La pasarela no respondió: la reversión quedó en ERROR y se puede reintentar"`.

> Guardar `data.id` como `reversion_id` en la devolución.

**Errores:**

| Código | Cuándo | `mensaje` (ejemplo) |
|---|---|---|
| 400 | Falta un campo o no cumple la regla | `El motivo debe tener entre 10 y 300 caracteres.` |
| 401 | Sin token, token vencido o inválido | `Token de acceso requerido` / `El token ha vencido` |
| 404 | La venta no existe | `No existe una venta con el número "VTA-1".` |
| 409 | La venta no tiene pago con tarjeta (Efectivo o QR) | `Solo se revierten pagos con tarjeta. La venta "VTA-1" se pagó con Efectivo: use otro tipo de reembolso.` |
| 409 | Ya tiene una reversión (doble reversión) | `La venta "VTA-1" ya tiene una reversión registrada; no se puede revertir dos veces.` · `detalle: { reversion_id, estado }` |
| 409 | La venta está anulada o con anulación en curso | `La venta "VTA-1" está anulada o tiene una anulación en curso; no se puede revertir.` |
| 409 | El cobro no está aprobado (PENDIENTE o RECHAZADA) | `El cobro de la venta "VTA-1" no está aprobado; no hay nada que revertir.` |

Ante un `409` por doble reversión, usar `detalle.reversion_id` para consultar la que ya existe, en lugar de crear otra.

## 3. Consultar

```http
GET /api/pagos/reversiones/8
```
`200` con `data` igual al punto 2 · `404` si no existe · `400` si el id no es un número.

```http
GET /api/pagos/reversiones?devolucion_id=DEV-000123
GET /api/pagos/reversiones?id_transaccion=VTA-022675
GET /api/pagos/reversiones?estado=ERROR
```
`200` con `{ "ok": true, "total": 1, "data": [ ... ] }`, de la más reciente a la más antigua (máx. 200). `estado` acepta `ENVIADA`, `CONFIRMADA` o `ERROR`.

## 4. Reintentar

```http
POST /api/pagos/reversiones/8/reintentar
```

Solo para reversiones en `ERROR`. Vuelve a hacer hasta 3 intentos y suma los intentos al total.

| Código | Cuándo |
|---|---|
| 200 | Se reintentó: `data.estado` es `CONFIRMADA` ("Reversión confirmada por la pasarela") o sigue en `ERROR` ("La pasarela volvió a fallar") |
| 404 | No existe esa reversión |
| 409 | Ya está `CONFIRMADA`, o se está enviando en este momento (`ENVIADA`) |

## Estados

| `estado` | Significa | Chip en el Comprobante de reembolso | Botón "Reintentar" |
|---|---|---|---|
| `ENVIADA` | Registrada y enviándose a la pasarela | Enviado | No |
| `CONFIRMADA` | La pasarela la aceptó; la venta quedó `Revertido` | Confirmado | No |
| `ERROR` | La pasarela falló en todos los intentos; ver `ultimo_error` | Error | **Sí** |

En las demás pantallas de pagos (Revisión de transacciones, monitoreo, historial de cajeros) la venta aparece como **`REVERTIDA`**, y en Facturas e historial del cliente como **`Revertido`**.

## Pasarela simulada (para probar)

El proyecto no tiene una pasarela real: `src/services/pasarelaSimulada.js` responde como una. Variables en el `.env` de `gestion_pagos`:

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `PASARELA_SIMULAR_FALLO` | `false` | `true` hace que falle siempre (para ver `ERROR` y probar "Reintentar") |
| `PASARELA_TASA_FALLO` | `0` | Probabilidad de fallo entre 0 y 1 (por ejemplo `0.3`) |
| `PASARELA_INTENTOS` | `3` | Intentos por envío |
| `PASARELA_ESPERA_MS` | `500` | Espera base entre intentos (se multiplica por el n.° de intento) |

## Ejemplo con fetch (backend de Devoluciones)

```js
const PAGOS = process.env.GESTION_PAGOS_URL || "http://localhost:4005";

async function revertirPagoConTarjeta({ idTransaccion, motivo, encargado, devolucionId }, token) {
  const r = await fetch(`${PAGOS}/api/pagos/reversiones`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      id_transaccion: idTransaccion,
      motivo,
      solicitado_por: encargado,
      devolucion_id: devolucionId,
    }),
  });
  const cuerpo = await r.json();
  if (!r.ok) throw new Error(cuerpo.mensaje); // 400, 401, 404 o 409
  return cuerpo.data; // guardar cuerpo.data.id como reversion_id; mirar cuerpo.data.estado
}
```
