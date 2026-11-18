# Pagos: estructura en componentes

> Fase 0009 de la migración. **No cambia nada visible ni la lógica**: solo divide `Pagos.jsx` (antes 1.188 líneas) para poder rediseñarlo con seguridad en la fase 0010.

## Dónde está cada cosa

| Archivo | Contenido |
|---|---|
| `src/pages/Pagos.jsx` | **Todo el estado, los efectos y las funciones del cobro** (vuelto, dólares, mixto, QR, duplicado, cancelación, factura por correo). Arma la pantalla con los componentes de abajo |
| `src/pages/pagos/constantes.js` | Estado inicial del formulario, `EFECTIVO_USD`, validaciones de NIT/CI, correo y mensaje de monto insuficiente |
| `src/pages/pagos/utilidades.js` | `validarFormulario`, `totalEnDolares`, `leyendaPagadoEnUsd`, `formatearTiempoRestante`, `hoyLocal`, `buscarCobroAnterior` |
| `src/pages/pagos/EncabezadoPagos.jsx` | Título, "Canceladas hoy" y "Mis respuestas rápidas" |
| `src/pages/pagos/SeccionMetodoPago.jsx` | Botones de método de pago (hasta 2 para un pago mixto) |
| `src/pages/pagos/CobroEfectivo.jsx` | Monto recibido, billetes rápidos y vuelto |
| `src/pages/pagos/CobroUsd.jsx` | Tipo de cambio, dólares recibidos y vuelto en Bs |
| `src/pages/pagos/DatosFacturacion.jsx` | Sin datos / NIT / CI, número, razón social y teléfono |
| `src/pages/pagos/EnvioCorreo.jsx` | ¿Enviar la factura por correo? y el correo del cliente |
| `src/pages/pagos/ResumenCobro.jsx` | Paso "Confirmar cobro" |
| `src/pages/pagos/CobroQrEspera.jsx` | Paso "Cobro con QR" (Pendiente, Pagado y Expirado) |
| `src/pages/pagos/PagoRegistrado.jsx` | Paso "Pago registrado" |

Los componentes de `src/pages/pagos/` **solo dibujan**: reciben los valores y avisan los cambios por props (`onCambiarMontoRecibido`, `onToggleMetodo`, `onConfirmar`…). No llaman a la API ni guardan estado del cobro.

## Cómo se comprobó que no cambió nada

- La función `Pagos()` es idéntica hasta su `return`, y las 16 constantes y funciones movidas son idénticas a las originales.
- Se recorrió la pantalla en 12 estados (formulario, efectivo con vuelto, NIT con error y correo, validación, dólares, mixto, confirmación, pago registrado, QR pendiente y los modales de cancelar venta, respuestas rápidas y cobro duplicado) y **el HTML generado es idéntico** antes y después.

## Pruebas después de este cambio

Como no cambia nada, basta con repetir un cobro de cada tipo:

- [ ] Efectivo con vuelto (billetes rápidos) y factura.
- [ ] Efectivo en dólares.
- [ ] Pago mixto.
- [ ] QR: generar, confirmar el pago recibido.
- [ ] Con NIT y envío por correo.
- [ ] Cancelar venta y aviso de cobro duplicado.
