# Microservicio Soporte

Sprint 4 · Equipo 2. Historias TDSI-63 a TDSI-67 (perfil **Usuario de Soporte**).

| | |
|---|---|
| **Puerto** | 4007 |
| **Esquema de base de datos** | `soporte` (`sql/script_soporte.sql`) |
| **Lee de** | Facturación (`FACTURACION_URL`) y Gestión de pagos (`GESTION_PAGOS_URL`), solo lectura |

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
