# Contrato · Vales de compra

TDSI-75. Para el **Equipo 1 (Devoluciones)**, que genera el vale en el paso "Reembolso" (opción **Vale**, TDSI-72), y para la página **"Vale de compra"** del Encargado (TDSI-228 y TDSI-1082).

> **Un dato, un dueño:** los vales los genera y los guarda `gestion_pagos` (tabla `pagos.vales_compra`). Devoluciones solo guarda el **código** del vale (`vale_codigo`) y no usa `devoluciones.vales_compra`.

| | |
|---|---|
| **Servicio** | `gestion_pagos` · puerto 4005 (`http://gestion_pagos:4005` dentro de docker-compose) |
| **Base** | `/api/pagos/vales` |
| **Formato** | JSON. Las respuestas siempre traen `ok`; si hay error, `mensaje` y `detalle` |

## Resumen

| Método | Ruta | Token | Quién lo usa |
|---|---|---|---|
| POST | `/api/pagos/vales` | **Sí** | Backend de Devoluciones, al elegir "Vale" como reembolso |
| GET | `/api/pagos/vales/:codigo` | No | Buscador de la página "Vale de compra" y la tarjeta imprimible |
| GET | `/api/pagos/vales?estado=&codigo=&devolucion_id=` | No | Tabla de vales de la página |

## El vale

```json
{
  "codigo": "VAL-6VUK-2HSM",
  "monto": 150.5,
  "saldo": 150.5,
  "estado": "Activo",
  "emitido_en": "2026-11-24T04:23:40.670Z",
  "expira_en": "2027-02-22",
  "dias_restantes": 90,
  "devolucion_id": "DEV-000123",
  "emitido_por": "encargado@tallersis.bo"
}
```

| Campo | Significa |
|---|---|
| `codigo` | Único, formato `VAL-XXXX-XXXX` (sin I, L, O, 0 ni 1 para que no se confundan). **Es lo que va en el QR.** |
| `monto` / `saldo` | Valor con el que se emitió / lo que queda por usar (al emitir, saldo = monto) |
| `expira_en` | Último día en que se puede usar (día de Bolivia, incluido), texto `AAAA-MM-DD` |
| `dias_restantes` | Días que faltan hasta `expira_en` (0 = vence hoy; negativo = ya venció) |
| `estado` | `Activo`, `Usado` (saldo 0) o `Expirado` |

## 1. Generar el vale (Devoluciones)

Pide el token como en la reversión (`POST /auth/token` con el Sistema Cliente `devoluciones`; ver `docs/contrato-reversion.md` o `npm run crear-cliente -- devoluciones "Devoluciones"`).

```http
POST /api/pagos/vales
Authorization: Bearer eyJ...
Content-Type: application/json

{ "monto": 150.50, "emitido_por": "encargado@tallersis.bo", "devolucion_id": "DEV-000123", "dias_validez": 90 }
```

| Campo | Obligatorio | Regla |
|---|---|---|
| `monto` | Sí | Mayor a 0, hasta Bs. 100 000, máx. 2 decimales |
| `emitido_por` | Sí | Encargado que lo genera (máx. 100) |
| `devolucion_id` | No | Devolución del Equipo 1 que lo genera (máx. 60) |
| `dias_validez` | No | Entero de 1 a 365. Por defecto `VALE_DIAS_VALIDEZ` (90) |

**Respuesta `201`:** `{ "ok": true, "mensaje": "Vale generado", "data": { ...el vale... } }`. Guardar `data.codigo` como `vale_codigo` en la devolución.

**Errores:** `400` (monto, días o campos inválidos), `401` (sin token o token vencido).

## 2. Consultar un vale (página y Devoluciones)

```http
GET /api/pagos/vales/VAL-6VUK-2HSM
```

`200` con `data` = el vale · `400` si el código no tiene el formato · `404` "No existe un vale con el código …". Acepta el código en minúsculas.

## 3. Listar vales (tabla de la página)

```http
GET /api/pagos/vales?estado=Activo
GET /api/pagos/vales?codigo=6VUK
GET /api/pagos/vales?devolucion_id=DEV-000123
```

`200` con `{ "ok": true, "total": 2, "data": [ ...vales... ] }`, del más nuevo al más antiguo (máx. 100). `estado` acepta `Activo`, `Usado` o `Expirado`.

## QR e impresión (frontend, TDSI-1082)

El backend **no** genera la imagen del QR: la pantalla dibuja el QR con el texto de `codigo` y arma la tarjeta imprimible con `codigo`, `monto`, `saldo` y `expira_en` ("Válido hasta").
