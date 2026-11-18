# Vales de compra

> Guía de pantalla del Sprint 4. Sigue `DESIGN_SYSTEM.md` y usa los componentes de `docs/COMPONENTES.md`.

| | |
|---|---|
| **Responsable** | Sebastián Orias (Equipo 2) |
| **Ruta y carpeta** | `/devoluciones/vales` (la abre también el detalle de la devolución) · carpeta `src/modules/pagos/` |
| **Backend** | `gestion_pagos` (generar vale, consultar saldo y estado por código). |
| **Figma** | p.2 (buscador) · p.3 (tabla y chips) · p.4 (tarjeta de marca navy con detalle dorado) |

## Historias

- **TDSI-75** · Como Encargado de Devoluciones, quiero generar vales de compra digitales con código QR y fecha de expiración

## Dónde va cada bloque

- **Encabezado:** título "Vales de compra" y buscador de código arriba.
- **Tabla de vales:** código · monto · saldo (`ui-num`) · válido hasta · estado (chip Pagado / Expirado…) · "Ver".
- **Vale abierto:** tarjeta imprimible **navy** con detalle dorado (`--gold` solo sobre navy), QR, código, monto, saldo y "Válido hasta". Botón contorno "Imprimir" arriba a la derecha.
- **Impresión:** estilos `@media print` solo para la tarjeta.

## Componentes a usar

- `CampoTexto` (buscador)
- `Tabla`, `Chip`
- `Tarjeta`
- `Boton` contorno
- `EstadoVacio` / `EstadoError`

## Subtareas de Jira (Frontend)

| Clave | Historia | Qué hacer | Horas | Quién |
|---|---|---|---|---|
| TDSI-228 | TDSI-75 | Crear la página "Vale de compra" con el buscador de código y su saldo | 1 h | Sebastian |
| TDSI-1082 | TDSI-75 | Generar el QR del vale y su versión para imprimir | 1 h | Sebastian |

## Pruebas de aceptación (texto exacto)

La pantalla tiene que cumplir estas PA. Los mensajes que aparecen entre comillas se escriben **igual** en la interfaz.

- [ ] (TDSI-75) El vale generado tiene que tener código único, monto y fecha de expiración
- [ ] (TDSI-75) Al consultar el código se tiene que ver el saldo
- [ ] (TDSI-75) El vale se tiene que poder imprimir con su QR

## Backend que necesita

Endpoints a cargo del equipo de backend. La pantalla no inventa datos: si un endpoint aún no existe, la sección queda oculta con su interruptor en `src/config/features.js`.

- TDSI-227 (TDSI-75): Crear la tabla de vales (código, monto, saldo, expiración, estado)
- TDSI-1032 (TDSI-75): Crear el endpoint para generar el vale con código único y fecha de expiración
- TDSI-1081 (TDSI-75): Crear el endpoint para consultar el saldo y el estado del vale por código
- TDSI-1109 (TDSI-75): Marcar como Expirado el vale vencido al consultarlo

## Reglas

- Toda llamada al backend va en el `api.js` del módulo, usando `apiFetch` de `src/api/client.js`.
- La lógica (estados del formulario, validaciones de la pantalla, llamadas) va en un hook del módulo; los componentes de `ui/` solo dibujan.
- Cada bloque que carga datos muestra cargando, vacío y error con "Reintentar".
- Nada de colores ni medidas fuera de `DESIGN_SYSTEM.md`; sin degradados ni sombras fuertes.
- El QR se genera en el frontend a partir del código; no inventar datos del vale en la pantalla.
