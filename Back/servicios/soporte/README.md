# Microservicio Soporte

Sprint 4 · Equipo 2. Historias TDSI-63 a TDSI-67 (perfil **Usuario de Soporte**).

| | |
|---|---|
| **Puerto** | 4007 |
| **Esquema de base de datos** | `soporte` (`sql/script_soporte.sql`) |
| **Lee de** | Facturación (`FACTURACION_URL`) y Gestión de pagos (`GESTION_PAGOS_URL`, con token), solo lectura |
| **Acceso** | Solo Usuario de Soporte y Administrador; el rol lo da gestion_caja (`GESTION_CAJA_URL`) |

## Base de datos

Ejecutar `sql/script_soporte.sql` en el SQL Editor de Supabase (es idempotente). Crea el esquema `soporte` con la tabla `incidentes` (TDSI-971):

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

## Acceso (TDSI-665)

Todo `/api/soporte/*` pide el token del **login de administración** (`POST /api/auth/login-administrador` de gestion_caja, el `access_token` que guarda `AdminAuthContext`):

```
Authorization: Bearer <administrador.access_token>
```

Solo pasan las cuentas con rol **`USUARIO_SOPORTE`** o **`ADMINISTRADOR`** (`caja.administradores.rol`, TDSI-992). Soporte no guarda cuentas: le pregunta el rol a gestion_caja con `GET /api/auth/perfil` y recuerda la respuesta 60 s (un cambio de rol o una desactivación tarda hasta 1 minuto en notarse).

| Código | Cuándo |
|---|---|
| 401 | Sin token, token inválido o vencido |
| 403 | La cuenta es de otro rol (Encargado de Devoluciones, cajero) o está desactivada |
| 503 | gestion_caja no responde |

`/health` no pide token. Variable nueva: `GESTION_CAJA_URL` (`http://localhost:4004`; en docker-compose, `http://gestion_caja:4004`).

## Endpoints

| Método | Ruta | Qué hace | Subtarea |
|---|---|---|---|
| GET | `/api/soporte/facturas/:numero` | Consulta una factura en Facturación (`GET /api/facturas/:numero`) y la devuelve con cliente, totales, ítems y métodos de pago. 400 si el número es inválido, 404 si no existe, 503 si Facturación no responde. | TDSI-1064 |
| GET | `/api/soporte/transacciones/:id` | Consulta una transacción en Gestión de pagos (`GET /transacciones/:id` y `/historial`, con token) y devuelve métodos, montos, total, cliente, caja, estado e historial. | TDSI-1066 |
| GET | `/api/soporte/comparacion?factura=F-000123&transaccion=TX-1` | Compara la factura con su transacción y marca las diferencias (`coincide`, `diferencias`, `avisos`). `transaccion` es opcional: si falta se usa la de la factura (`venta_id`). | TDSI-972 |
| GET | `/api/soporte/tickets?pagina=1&limite=20` | Bandeja de tickets ordenada por prioridad (Critica, Alta, Media, Baja) y, dentro de cada una, del más nuevo al más antiguo. `limite` de 1 a 100 (por defecto 20). Responde `data` y `paginacion: { pagina, limite, total, paginas }`. | TDSI-671 |
| GET | `/api/soporte/tickets?numero=&usuario=&desde=&hasta=&estado=&prioridad=` | Filtros de la bandeja, combinables entre sí y con la paginación: `numero` (parte del número, p. ej. `12`), `usuario` (parte del usuario afectado), `desde`/`hasta` (AAAA-MM-DD, días en hora de Bolivia, `hasta` incluido), `estado` y `prioridad` (valor exacto). 400 si un valor no es válido. | TDSI-674 |
| POST | `/api/soporte/tickets` | Registra un ticket. Cuerpo: `tipo` (Facturacion, Pagos, Acceso, Error del sistema, Otro), `descripcion` (obligatoria, máx. 2000), `prioridad` (Baja, Media, Alta, Critica; por defecto Media), `usuario_afectado`, `referencia_tipo` (factura/transaccion) + `referencia` (van juntos). Nace en **Abierto** con número `INC-NNNNNN`; `registrado_por` es el usuario de la sesión. 201 con el ticket, 400 si falta algo. | TDSI-668 |
| GET | `/api/soporte/historial?usuario=cajero1@tallersis.bo` | Historial de incidencias de un usuario afectado (mismo valor, sin distinguir mayúsculas), del más reciente al más antiguo: `numero`, `fecha`, `tipo`, `prioridad`, `estado`, `descripcion`, referencia, `solucion`, `resuelto_en`, `cerrado_en`. `resumen: { usuario, total, abiertos, resueltos, mostrados }` (máx. 200 filas). 400 sin `usuario`. | TDSI-209 |
| GET | `/api/soporte/historial/usuarios?q=` | Usuarios que tienen incidentes (para el buscador): `usuario`, `cantidad`, `ultimo_en`; `q` filtra por parte del nombre o correo. | TDSI-209 |
| GET | `/api/soporte/catalogos` | Tipos, prioridades y estados válidos (para los selectores). | TDSI-677 |
| GET | `/api/soporte/tickets/:numero` | Detalle de un ticket (`INC-000123`) con su solución. 400 si el número es inválido, 404 si no existe. | TDSI-677 |
| PATCH | `/api/soporte/tickets/:numero/tipo` | Cuerpo `{ tipo }`. Cambia el tipo y lo deja en el historial con el usuario de la sesión y la hora. Responde el ticket actualizado. | TDSI-677 |
| PATCH | `/api/soporte/tickets/:numero/prioridad` | Cuerpo `{ prioridad }` (Baja, Media, Alta, Critica). Cambia la prioridad y registra el cambio en el historial (valor anterior, nuevo, usuario y hora). | TDSI-680 |
| PATCH | `/api/soporte/tickets/:numero/estado` | Cuerpo `{ estado }`. Aplica las reglas de transición (ver abajo); 409 con `detalle.permitidos` si no se permite. Marca `resuelto_en` / `cerrado_en` y lo deja en el historial. | TDSI-693 |
| GET | `/api/soporte/tickets/:numero/historial` | Cambios de estado del más antiguo al más nuevo: `[{ id, estado_anterior, estado_nuevo, usuario, cambiado_en }]`. Con `?campo=todos` también los de tipo y prioridad (`campo`, `valor_anterior`, `valor_nuevo`). | TDSI-693 |

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

### Reglas de transición del estado (TDSI-693)

| Desde | Puede pasar a |
|---|---|
| Abierto | En proceso, Pendiente, Resuelto* |
| En proceso | Pendiente, Resuelto* |
| Pendiente | En proceso, Resuelto* |
| Escalado | En proceso (vuelve del Administrador, TDSI-65) |
| Resuelto | Cerrado, En proceso (reabrir) |
| Cerrado | — (estado final) |

\* Resuelto exige que el ticket ya tenga la solución aplicada. Escalado no se elige a mano. Las reglas están en `src/domain/transicionesEstado.js`.

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
