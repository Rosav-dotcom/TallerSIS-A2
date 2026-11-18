# Facturas del cajero

> Migración de la fase 0008. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Archivos** | `src/pages/Facturas.jsx`, `src/components/BuscadorFacturas.jsx`, `ResumenFactura.jsx`, `ComparacionModificacion.jsx`, `RespuestasAnulacionBotones.jsx`, `MisRespuestasAnulacion.jsx`, `src/pages/facturas.css` |
| **Figma** | p.36 (lista) · p.37 (solicitar anulación y respuestas rápidas) · p.38 (autorización del supervisor) · p.44 (modificar factura) |
| **No se toca** | La carga y la búsqueda (con espera y sin respuestas cruzadas), el plazo de 2 horas, la anulación en dos pasos, la modificación con sus validaciones de NIT/CI, el resumen de la factura, las respuestas de anulación y las anuladas del turno |

## Lista

- Encabezado "Facturas" con "Mis respuestas de anulación" y "Anuladas en el turno" a la derecha.
- Filtros: Desde, Hasta y el buscador con lupa e ícono de escáner; "Limpiar" aparece cuando hay un filtro.
- Tabla del sistema: el total alineado a la derecha y el estado como chip (**Emitida** en verde, **Anulación solicitada** en ámbar, **Anulada** en gris).
- Acciones como botones de texto: **Ver** (PDF), **Anular factura** (en rojo) y **Modificar factura**, solo dentro de las 2 horas. Si no, "Esperando a un supervisor..." o "Fuera de plazo (2h)".
- Sin resultados: "No se encontraron facturas", "No hay facturas en ese rango de fechas." o "Todavía no emitiste ninguna factura.".
- Esta pantalla usa hasta 1280 px de ancho (el resto del cajero sigue en 960 px).

## Modales

- **Autorización de supervisor:** el resumen de la factura con sus ítems, las respuestas de anulación como botones de un clic, el motivo con contador, el usuario del supervisor (con el foco al abrir) y el PIN.
- **¿Está seguro?:** la factura y el motivo, con "No" y "Sí, anular" en rojo. Mientras anula, no se puede cerrar.
- **Modificar factura:** el tiempo que queda (o el aviso de que pasaron las 2 horas), el resumen, el tipo de documento NIT/CI, los datos nuevos, la tabla "Cambios solicitados" con la marca **Modificado** y el supervisor con su PIN.
- **Anuladas en el turno** y **Mis respuestas de anulación** (agregar, editar y eliminar con confirmación).
- Todos se cierran con Escape o con la ✕, igual que con "Cancelar".

## Pruebas después de este cambio

- [ ] La lista carga las facturas del cajero y el buscador filtra por número, NIT/CI o nombre.
- [ ] Una factura de menos de 2 horas muestra "Anular factura" y "Modificar factura"; una más antigua, "Fuera de plazo (2h)".
- [ ] Anular: elegir una respuesta, poner el supervisor y el PIN, confirmar y ver el aviso "La factura … fue anulada.".
- [ ] Con un PIN incorrecto se vuelve a pedir las credenciales con el motivo del error.
- [ ] Modificar: un CI de menos de 7 dígitos muestra "El CI debe tener entre 7 y 8 dígitos."; con datos correctos se guarda.
- [ ] Mis respuestas de anulación: agregar, editar y eliminar una respuesta.
- [ ] Anuladas en el turno lista las anuladas con su total.
