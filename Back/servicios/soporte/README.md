# Microservicio Soporte

Sprint 4 · Equipo 2. Historias TDSI-63 a TDSI-67 (perfil **Usuario de Soporte**).

| | |
|---|---|
| **Puerto** | 4007 |
| **Esquema de base de datos** | `soporte` (`sql/script_soporte.sql`) |
| **Lee de** | Facturación (`FACTURACION_URL`) y Gestión de pagos (`GESTION_PAGOS_URL`, con token), solo lectura |

## Base de datos

Ejecutar una vez `sql/script_soporte.sql` en el SQL Editor de Supabase (es idempotente). Crea el esquema `soporte` con la tabla `incidentes` (TDSI-971):

| Campo | Valores |
|---|---|
| `numero` | Correlativo automático `INC-000001` |
| `tipo` | Facturacion, Pagos, Acceso, Error del sistema, Otro |
| `referencia_tipo` / `referencia` | `factura` o `transaccion` + número (opcional, van juntos) |
| `estado` | Abierto (inicial), En proceso, Pendiente, Resuelto, Cerrado, Escalado |
| `prioridad` | Baja, Media (inicial), Alta, Critica |

Soporte no copia facturas ni transacciones: guarda solo la referencia y lee los datos por HTTP.

## Levantarlo

```bash
cp .env.example .env    # y completar DATABASE_URL
npm install
npm run dev
```

O con todo el backend: `docker compose up --build` desde `Back/`.

Comprobar: `GET http://localhost:4007/health` → `{ "ok": true, "servicio": "soporte", "db": "up" }`.

## Documentación

- Diagrama de clases (TDSI-974): [`docs/diagrama-clases.md`](docs/diagrama-clases.md)

## Tests

```bash
npm test
```

No necesitan base de datos ni los otros servicios (usan datos y `fetch` simulados). TDSI-973:

| Archivo | Qué prueba |
|---|---|
| `test/compararFacturaYTransaccion.test.js` | Cada regla de diferencias: total, métodos (pago mixto), cliente, estados, referencia, transacción inexistente, redondeo y avisos |
| `test/comparacionService.test.js` | Uso del `venta_id`, prioridad del ID enviado, 400 sin datos, 404 como diferencia y 503 propagado |
| `test/clientes.test.js` | Token de gestion_pagos: cache, renovación, reintento con 401, credenciales faltantes o rechazadas; servicio caído |
| `test/rutas.test.js` | Los tres endpoints por HTTP con sus códigos 200/400/404 |

## Endpoints (solo lectura)

| Método | Ruta | Qué hace | Subtarea |
|---|---|---|---|
| GET | `/api/soporte/facturas/:numero` | Consulta una factura en Facturación (`GET /api/facturas/:numero`) y la devuelve con cliente, totales, ítems y métodos de pago. 400 si el número es inválido, 404 si no existe, 503 si Facturación no responde. | TDSI-1064 |
| GET | `/api/soporte/transacciones/:id` | Consulta una transacción en Gestión de pagos (`GET /transacciones/:id` y `/historial`, con token) y devuelve métodos, montos, total, cliente, caja, estado e historial. | TDSI-1066 |
| GET | `/api/soporte/comparacion?factura=F-000123&transaccion=TX-1` | Compara la factura con su transacción y marca las diferencias (`coincide`, `diferencias`, `avisos`). `transaccion` es opcional: si falta se usa la de la factura (`venta_id`). | TDSI-972 |

### Qué compara (TDSI-972)

| Campo | Diferencia cuando… |
|---|---|
| `transaccion` | La transacción no existe en Gestión de pagos |
| `referencia` | La factura apunta a otra transacción |
| `total` | El total facturado y el cobrado difieren en 1 centavo o más |
| `metodo_pago.<Método>` | Un método está solo en un lado o su monto no coincide (el pago mixto se suma por método) |
| `cliente.nit` / `cliente.razon_social` | El NIT/CI o la razón social no coinciden (sin distinguir mayúsculas, tildes ni espacios) |
| `estado` | Factura Emitida con pago Anulado, o factura Anulada con pago Registrado |
| `estado_pago` | Factura Emitida con pago PENDIENTE o RECHAZADA |

En `avisos` van los casos que no son error pero conviene revisar: factura sin métodos de pago, en borrador o con anulación solicitada. La regla está en `src/domain/compararFacturaYTransaccion.js` (función pura, sin base de datos).

### Credenciales para Gestión de pagos (TDSI-1066)

Las rutas de transacciones de `gestion_pagos` piden el token del Sistema Cliente. Soporte se registra una sola vez como cliente:

```bash
cd ../gestion_pagos
npm run crear-cliente -- soporte "Soporte"
```

Copiar el `client_secret` que muestra (no se puede recuperar después) al `.env` de soporte:

```
GESTION_PAGOS_CLIENT_ID=soporte
GESTION_PAGOS_CLIENT_SECRET=<el secreto>
```

Soporte pide el token con `POST /auth/token`, lo guarda en memoria y lo renueva antes de que venza.
