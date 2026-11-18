# Inicio, apertura de turno, Cierre de caja y Arqueo

> Migración de la fase 0007. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Archivos** | `src/pages/Home.jsx`, `src/components/TurnoModal.jsx`, `src/pages/CierreCaja.jsx`, `src/components/ArqueoEfectivo.jsx`, `src/pages/turno.css` |
| **Figma** | p.12–13 (apertura de turno y autorización) · p.45–46 (Cierre de caja) · p.47–48 y p.59–60 (Arqueo) · p.61 (Caja cerrada exitosamente) |
| **No se toca** | La consulta del turno actual, la apertura con supervisor y PIN, el cálculo del arqueo (`utils/arqueo.js`), el reporte de cierre, el cierre del turno, el PDF y el regreso al login |

El flujo del Figma separa el arqueo y la autorización en más pasos que el sistema actual. Para no cambiar la lógica, **se mantienen los 3 pasos que ya existen** (`ingreso`, `reporte` y `listo`) y a cada uno se le aplica el diseño de su página.

## Inicio y apertura de turno

- Encabezado "Bienvenido, …" y la terminal con su caja.
- El aviso de turno usa el `Modal` del sistema, sin botón de cerrar (como antes):
  - **Turno activo:** el código del turno y "Continuar".
  - **Turno inactivo:** efectivo inicial con prefijo "Bs", usuario del supervisor, PIN, "Abrir turno" y "Esta autorización quedará registrada en la auditoría.".
  - **Turno abierto correctamente:** turno, efectivo inicial y quién autorizó.

## Cierre de caja

| Paso | Diseño |
|---|---|
| `ingreso` | Dos columnas: **Arqueo de efectivo** (billetes y monedas lado a lado, el total contado en vivo) y **Autorización del supervisor** (usuario, PIN y "Continuar al Reporte") |
| `reporte` | **Reporte de cierre** (tabla método, operaciones y neto, con el total recaudado en una barra navy) y el detalle del arqueo con su resultado; a la derecha, **Antes de cerrar** (efectivo, digital, ventas, anuladas, "Ver anuladas", "Volver" y "Cerrar caja y continuar" en rojo) |
| `listo` | "✓ Caja cerrada exitosamente" en verde, el arqueo revisado y "Volver al Inicio" |

- El resultado del arqueo se colorea según su estado: **Cuadra** en verde, **Faltante** en rojo, **Sobrante** en ámbar y sin dato en gris.
- "Ver anuladas" abre el `Modal` con la tabla de facturas anuladas del turno (ahora también se cierra con Escape).
- Los mensajes de error y de validación son los mismos de antes, en alerta roja.

## Pruebas después de este cambio

- [ ] Con turno abierto, Inicio muestra "Turno activo" y "Continuar" lo cierra.
- [ ] Sin turno, "Abrir turno" pide el efectivo inicial y el supervisor; con datos correctos muestra "Turno abierto correctamente".
- [ ] En el arqueo, una letra muestra "Solo números enteros" y el subtotal y el total se actualizan al escribir.
- [ ] "Continuar al Reporte" sin supervisor muestra el aviso; con supervisor, muestra el reporte.
- [ ] "Ver anuladas" lista las facturas anuladas del turno.
- [ ] "Cerrar caja y continuar" cierra el turno, abre el PDF y muestra "Caja cerrada exitosamente".
- [ ] "Volver al Inicio" cierra la sesión y vuelve al login.
