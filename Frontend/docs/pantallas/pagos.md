# Cobrar (Pagos)

> Migración de la fase 0010. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`. La estructura en archivos está en `pagos-estructura.md` (fase 0009).

| | |
|---|---|
| **Archivos** | `src/pages/Pagos.jsx` (solo su `return`), `src/pages/pagos/*.jsx`, `src/pages/pagos/pagos.css`, `src/components/PagoMixtoForm.jsx`, `DesgloseVuelto.jsx`, `CancelarVentaModal.jsx`, `AvisoCobroDuplicadoModal.jsx`, `RespuestasRapidasBotones.jsx`, `MisRespuestasRapidas.jsx` |
| **Figma** | p.7 y p.14–16 (cobrar) · p.22 (pago mixto) · p.23 (posible cobro duplicado) · p.24–26 (cobro con QR) · p.34–35 (cobro completado) · p.72–73 (cancelar venta) · p.74 (métodos y respuestas rápidas) |
| **No se toca** | El estado y las funciones de `Pagos()`, el cálculo del vuelto, el tipo de cambio y el cobro en dólares, la validación de montos del pago mixto, la búsqueda del cliente por NIT/CI, el QR con su cuenta regresiva, el aviso de cobro duplicado, la cancelación de la venta y el envío de la factura por correo |

## Formulario

- Encabezado **Cobrar** con "Canceladas hoy" debajo y "Mis respuestas rápidas" a la derecha.
- Dos tarjetas en columnas: **Venta** (monto a cobrar, método de pago y el bloque de efectivo o dólares) y **Cliente** (Sin datos / NIT / CI, número, razón social, teléfono y la pregunta del correo).
- Los métodos de pago son opciones grandes con ícono; la elegida queda en azul marino (hasta 2 para el pago mixto).
- Efectivo: monto recibido con "Bs" fijo, billetes rápidos (+10 a +200 y Limpiar) y el vuelto con su desglose en billetes y monedas (las monedas con borde punteado).
- El NIT/CI mal escrito se marca en el propio campo, en rojo.
- Abajo a la derecha: **Cancelar venta** (solo con un monto) y **Continuar**.
- Pago mixto: el formulario pasa a una columna y a la derecha aparece la tarjeta **Pago mixto** con el monto de cada método, la suma ("✓ Montos cuadrados" o lo que falta o sobra), el efectivo recibido y "Validar montos".
- Esta pantalla usa hasta 1280 px de ancho, como Facturas. En pantallas angostas todo va en una columna.

## Pasos siguientes

- **Confirmar cobro:** el detalle en filas, el **Total a cobrar** grande, el vuelto y los botones Cancelar venta, Editar y Confirmar cobro (o Generar QR).
- **Cobro con QR:** el estado como chip (**Pendiente**, **Pagado**, **Expirado**), el monto, la referencia, el QR y la cuenta regresiva.
- **Pago registrado:** el ✓ en verde, el ID y la fecha, el detalle, el **Total pagado**, el aviso del envío por correo, "Ver / Imprimir factura" y "Registrar otro pago".

## Modales

- **Cancelar venta:** respuestas rápidas de un clic, los motivos como opciones con su círculo y, con "Otro", el texto con contador (el foco va a ese campo). Volver y Cancelar venta en rojo. Escape o la ✕ equivalen a Volver (mientras se cancela, no se puede cerrar).
- **Posible cobro repetido:** el texto del cobro anterior y la tabla de comparación. El foco empieza en **Cancelar**; Escape también cancela. Es un `alertdialog`.
- **Mis respuestas rápidas:** agregar, editar y eliminar con confirmación, como "Mis respuestas de anulación".

## Pruebas después de este cambio

- [ ] Efectivo con billetes rápidos: el vuelto y su desglose aparecen al llegar al monto.
- [ ] Efectivo en dólares: tipo de cambio, total en USD, equivalente y vuelto en Bs.
- [ ] Pago mixto: con montos que no suman se ve lo que falta; con montos que cuadran, "Validar montos" muestra el aviso verde.
- [ ] NIT de menos de 10 dígitos: error en el campo y no avanza.
- [ ] Confirmar y cobrar: se ve "Pago registrado" y "Ver / Imprimir factura" abre el PDF.
- [ ] Con correo: el aviso de factura enviada (o el error).
- [ ] QR: generar, ver la cuenta regresiva y confirmar el pago recibido; dejarlo expirar y regenerarlo.
- [ ] Cancelar venta: sin motivo pide elegir uno; con una respuesta rápida se cancela en un clic.
- [ ] Mis respuestas rápidas: agregar, editar y eliminar.
- [ ] Cobro repetido al mismo cliente: aparece el aviso; "Cancelar" vuelve y "Cobrar igual" registra el pago.
