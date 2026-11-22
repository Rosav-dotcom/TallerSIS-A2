# Microservicio Soporte

Sprint 4 · Equipo 2. Historias TDSI-63 a TDSI-67 (perfil **Usuario de Soporte**).

| | |
|---|---|
| **Puerto** | 4007 |
| **Esquema de base de datos** | `soporte` (`sql/script_soporte.sql`) |
| **Lee de** | Facturación (`FACTURACION_URL`) y Gestión de pagos (`GESTION_PAGOS_URL`), solo lectura |

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

## Tests

```bash
npm test
```
