# Login y menús por rol

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Aylen Claros (Equipo 1) · rutas de Soporte: Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/login` (existente) y el menú de cada rol |
| **Backend** | `gestion_caja` (login, `/api/auth`) — los roles nuevos los agrega TDSI-992. |
| **Figma** | p.6 (Login con "Perfil de acceso") · p.8 (navegación por roles) · p.57–58 (Usuarios) |

## Historias

- **TDSI-68** · Como Encargado de Devoluciones, quiero buscar el comprobante de venta original por número de factura o NIT/CI
- **TDSI-66** · Como Usuario de Soporte, quiero registrar tickets, consultarlos y buscarlos en la bandeja, y ver el historial de incidencias de cada usuario

## Dónde va cada bloque

- **Login (pantalla existente):** pestañas "Perfil de acceso" con Cajero, Administrador, Encargado de Devoluciones y Usuario de Soporte. El campo "Caja" aparece **solo** para Cajero.
- **Menú del Encargado de Devoluciones:** Nueva devolución · Devoluciones · Vales de compra · Reportes.
- **Menú del Usuario de Soporte:** Buscar factura o pago · Incidentes · Historial por usuario · Reportes.
- **Administrador:** se suma "Soporte > Incidentes escalados" y, en Inicio, "Tablero de KPIs".
- **Rutas protegidas por rol:** si el rol no corresponde, se redirige al inicio de su perfil (Cajero → `/`, Administrador → `/admin/tablero`).

## Componentes a usar

- `Pestanas` (perfil de acceso)
- `CampoTexto`, `CampoContrasena`, `Selector` (caja)
- `Boton` primario "Ingresar"
- `Alerta` tono error para credenciales inválidas

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-993 | TDSI-68 | Mostrar en el menú solo las opciones de cada rol nuevo | 1 h | Aylen |
| TDSI-666 | TDSI-66 | Proteger las rutas de Soporte para que solo las abra el Usuario de Soporte | 1 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-68) Un Cajero no tiene que ver el menú Devoluciones ni el menú Soporte
- [ ] (TDSI-66) Un cajero que abre una ruta de Soporte tiene que ser enviado a su pantalla de inicio

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-992 (TDSI-68): Agregar los roles Encargado de Devoluciones y Usuario de Soporte al login de administrador y a la pantalla Usuarios (TDSI-47)
- TDSI-665 (TDSI-66): Crear el middleware de rol del microservicio Soporte que solo acepta al Usuario de Soporte y al Administrador

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- El rediseño visual completo del Login se hace en la fase de migración 0006. En el Sprint 4 **solo se agregan** los perfiles nuevos y la redirección por rol; no reescribir el login.
- Los menús y rutas nuevos se agregan con un interruptor en `src/config/features.js` (`devoluciones`, `soporte`, `tableroKpis`) y se encienden cuando la historia esté probada.
