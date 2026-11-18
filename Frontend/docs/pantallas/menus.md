# Menús del cajero y del administrador

> Migración de la fase 0005. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Archivos** | `src/components/Navbar.jsx` (cajero), `src/components/AdminNavbar.jsx` (administrador), `src/components/navegacion.css` |
| **Figma** | p.7 (barra del cajero en "Registrar cobro") · p.8 (navegación por roles y mapa del administrador) · p.17 (barra superior del administrador) |
| **No se toca** | `AuthContext`, `AdminAuthContext`, `BloqueoContext`, las rutas de `App.jsx` y lo que hace cada botón |

## Cajero (barra superior)

- **Izquierda:** logo RePay en un bloque navy, con el punto dorado.
- **Pestañas:** Inicio (`/`) · Cobrar (`/pagos`) · Facturas (`/facturas`). La activa lleva una línea olive debajo.
- **Derecha:** nombre y código de la caja · usuario con su avatar y el menú **Cerrar caja / Cerrar sesión** · botón contorno **Bloquear** con candado (TDSI-855).

## Administrador (barra lateral y barra superior)

- **Barra lateral navy** con las secciones de la p.8, que se abren o cierran por separado. Al entrar a una pantalla se abre sola la sección que la contiene, y la pantalla activa lleva una línea dorada a la izquierda.

| Sección | Pantallas |
|---|---|
| Inicio | Tablero de ingresos · Tablero de KPIs (Sprint 4) |
| Operación | Cierre diario · Historial de operaciones · Diferencias de caja |
| Análisis | Comparativo mensual · Horas pico · Metas de venta · Productos vendidos · Ventas online |
| Facturación | Libro de Ventas |
| Personas | Cajeros · Clientes · Supervisores · Usuarios |
| Soporte | Incidentes escalados (Sprint 4) |

- **Barra superior:** "Administración" con la fecha del día; a la derecha, el nombre del administrador y **Cerrar sesión**.
- El contenido de cada pantalla queda al lado de la barra lateral (clase `con-barra-lateral` en el `<main>` de `App.jsx`).

## Para el Sprint 4

### Interruptores: `src/config/features.js`

```js
export const FEATURES = { devoluciones: false, soporte: false, tableroKpis: false }
```

- "Tablero de KPIs" e "Incidentes escalados" ya están en el menú, pero solo aparecen con `tableroKpis: true` y `soporte: true`.
- Cada equipo enciende su interruptor **en el mismo Pull Request** que deja su historia terminada y probada.
- Las rutas nuevas también se envuelven con el interruptor: `{FEATURES.devoluciones && <Route … />}`.

### Rutas por rol: `src/components/RutaPorRol.jsx`

```jsx
<Route path="/devoluciones/nueva" element={<RutaPorRol roles={['ENCARGADO_DEVOLUCIONES']}><NuevaDevolucion /></RutaPorRol>} />
```

- Sin sesión, va a `/login`. Con un rol no permitido, va al inicio de su perfil: Cajero `/`, Administrador `/admin/tablero`, Encargado `/devoluciones`, Soporte `/soporte`.
- El rol sale de `useRolActual()` (`src/hooks/useRolActual.js`). Los roles nuevos llegan cuando el login de administrador devuelva el campo `rol` (TDSI-992); mientras tanto, una sesión de administrador cuenta como `ADMINISTRADOR`.
- Cumple las PA "Un Cajero no tiene que ver el menú Devoluciones ni el menú Soporte" (TDSI-997) y "Un cajero que abre una ruta de Soporte tiene que ser enviado a su pantalla de inicio" (TDSI-667).

### Menús de los roles nuevos

Los menús del Encargado de Devoluciones y del Usuario de Soporte (p.8) usan la misma barra lateral. Se agregan en `AdminNavbar.jsx` como listas de secciones por rol, dentro de la subtarea TDSI-993, y se muestran según `useRolActual()`.

## Pruebas después de este cambio

- [ ] Cajero: Inicio, Cobrar y Facturas llevan a su pantalla y la activa se ve marcada.
- [ ] Cajero: el menú del usuario muestra Cerrar caja y Cerrar sesión, y se cierra al hacer clic fuera.
- [ ] Cajero: "Cerrar caja" lleva a Cierre de caja y "Bloquear" bloquea la pantalla sin cerrar el turno.
- [ ] Administrador: las 14 pantallas están en la barra lateral y cada una abre su página.
- [ ] Administrador: "Cerrar sesión" vuelve al login.
- [ ] Ninguna pantalla queda tapada por la barra lateral.
