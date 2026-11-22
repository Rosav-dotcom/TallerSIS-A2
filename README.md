# TallerSis

Taller Sis
---

## Microservicios del Backend

A continuación se listan los microservicios implementados en el proyecto, con enlaces a su documentación específica:

### 🔹 Devoluciones y reembolsos

- **Descripción:** Microservicio del Encargado de Devoluciones: busca el comprobante de venta original (consultando a Facturación), registra devoluciones totales o parciales, reembolsos, notas de crédito, vales y su historial.
- **Puerto:** 4008
- **Ruta:** `Back/servicios/devoluciones_reembolsos/`
- **Base de datos:** esquema `devoluciones` (`sql/script_devoluciones.sql`)
- **Tareas Jira:** TDSI-68 a TDSI-82 (Sprint 4)

### 🔹 Gestión de Pagos (RePay)

- **Descripción:** Microservicio encargado de recibir, validar y registrar los métodos de pago (Efectivo, Tarjeta, QR) seleccionados por los cajeros.
- **Puerto:** 4005
- **Ruta:** `Back/servicios/gestion_pagos/`
- **Documentación completa:** [Ver README del microservicio](./Back/servicios/gestion_pagos/README.md)
- **Tareas Jira:** TDSI-85, TDSI-262, TDSI-271, TDSI-272
