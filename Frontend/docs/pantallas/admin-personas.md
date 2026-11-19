# Administrador: Personas y Facturación

> Migración de la fase 0012. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`. Las clases comunes de las páginas del administrador (`adm-*`) están en `src/pages/admin.css`; las páginas de la fase 0013 usan el mismo archivo.

| | |
|---|---|
| **Archivos** | `src/pages/Cajeros.jsx`, `Clientes.jsx`, `Supervisores.jsx`, `Usuarios.jsx`, `LibroVentas.jsx` (solo su `return`) y `src/pages/admin.css` |
| **Figma** | p.75 (menú y componentes del administrador) y el sistema de diseño |
| **No se toca** | Las llamadas a la API, las validaciones (PIN de 4 a 6 dígitos, contraseña de al menos 6 caracteres, confirmaciones), el filtro por rol, la búsqueda por NIT o CI, el filtro de fechas de las facturas y la descarga del Libro de Ventas en Excel |

## Estructura común

- El título y la descripción van arriba; la acción principal ("Nuevo supervisor", "Nuevo cajero") va a la derecha.
- Los filtros van en una fila (`Selector`, `CampoTexto`).
- Las tablas usan `Tabla`, con los montos alineados a la derecha. Las acciones de cada fila son botones de texto; "Desactivar" va en rojo.
- Los estados son chips: **Emitida / Anulada**, **Vigente / Anulada**, y **Activo / Inactivo / Bloqueado**.
- Los formularios y las confirmaciones usan `Modal`: el foco entra en el primer campo, y Escape o la ✕ equivalen a "Cancelar" (mientras se guarda, no se puede cerrar).
- Los PIN y las contraseñas usan `CampoContrasena`, con el ojo para mostrar u ocultar.
- Los avisos y errores son `Alerta`; las listas vacías usan `EstadoVacio`.

## Por página

- **Cajeros:** la tabla de cajeros y "Ver facturas", que abre la ventana con Desde, Hasta y las facturas del cajero. Como esa tabla es larga, la ventana llega hasta 1040 px.
- **Buscar cliente:** NIT o CI, el número (solo dígitos), los totales del cliente (veces que vino, total gastado y anuladas en rojo) y sus facturas.
- **Supervisores:** nuevo supervisor, restablecer PIN y activar o desactivar con confirmación.
- **Usuarios:** el filtro por rol, nuevo cajero, editar (con "Cambiar contraseña" para los cajeros) y activar o desactivar.
- **Libro de Ventas:** mes, año, "Descargar Libro de Ventas" y la tabla con los totales del mes. Las facturas anuladas se ven en gris.

## Pruebas después de este cambio

- [ ] Cajeros: "Ver facturas" abre la ventana; con Desde y Hasta se filtra y "Quitar filtro" vuelve a todas.
- [ ] Buscar cliente: sin número muestra "Ingrese el número de NIT o CI a buscar."; con un NIT existente se ven sus totales y facturas.
- [ ] Supervisores: un PIN de 2 dígitos muestra "El PIN debe tener entre 4 y 6 dígitos."; con datos correctos aparece "Supervisor … registrado correctamente.".
- [ ] Supervisores: restablecer PIN con una confirmación distinta muestra "El PIN y su confirmación no coinciden."; desactivar y volver a activar.
- [ ] Usuarios: el filtro por rol, editar un cajero con una contraseña corta ("La contraseña debe tener al menos 6 caracteres.") y con una correcta, y nuevo cajero.
- [ ] Libro de Ventas: cambiar el mes y descargar el Excel.
