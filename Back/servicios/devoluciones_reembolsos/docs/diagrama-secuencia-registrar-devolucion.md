# Diagrama de secuencia · Registrar devolución

TDSI-1004 (historia TDSI-70). Qué pasa desde que el Encargado de Devoluciones busca el comprobante hasta que la devolución queda registrada con su código `DEV-NNNNNN`. Los nombres son los módulos reales de `devoluciones_reembolsos` (ver [diagrama-clases.md](diagrama-clases.md)).

El motivo y las observaciones (TDSI-71) ya están en el flujo. La opción de reembolso (TDSI-72) y la autorización del supervisor sobre el límite (TDSI-80) se suman en sus historias.

## 1. Buscar el comprobante y ver el plazo (paso 1 de "Nueva devolución")

```mermaid
sequenceDiagram
    autonumber
    actor E as Encargado de Devoluciones
    participant UI as Front: NuevaDevolucion
    participant CR as ComprobantesRoutes
    participant CS as ComprobantesService
    participant FC as FacturacionClient
    participant F as Facturacion :4002
    participant PS as PlazoService
    participant CFG as ConfiguracionService
    participant DB as PostgreSQL

    E->>UI: escanea el código de barras o escribe N.º de factura / NIT
    UI->>CR: GET /api/devoluciones/comprobantes?q=F-000123
    CR->>CS: buscarComprobantes(q)
    CS->>FC: buscarFacturas(q)
    FC->>F: GET /api/facturas/buscar?q=
    F-->>FC: criterio numero, facturas
    CS->>FC: obtenerFactura(numero)
    FC->>F: GET /api/facturas/F-000123
    F-->>FC: factura con items (id), metodosPago
    alt anulada, borrador o no existe
        CS-->>UI: 404 "Comprobante no encontrado o anulado"
    else anulación pendiente
        CS-->>UI: 409
    else emitida
        CS->>PS: plazoDeComprobante(fecha)
        PS->>CFG: obtenerPlazoDias()
        CFG->>DB: SELECT valor FROM configuracion (plazo_dias_habiles)
        DB-->>CFG: 7
        PS-->>CS: dias_transcurridos, fecha_limite, dentro_de_plazo, aviso
        CS-->>UI: 200 comprobante con items[].item_id y plazo
    end
    UI-->>E: tarjeta del comprobante y "Todo en orden" / "Revisión pendiente"
```

## 2. Registrar la devolución

```mermaid
sequenceDiagram
    autonumber
    actor E as Encargado de Devoluciones
    participant UI as Front: NuevaDevolucion
    participant DR as DevolucionesRoutes
    participant RS as RegistroService
    participant CS as ComprobantesService
    participant F as Facturacion :4002
    participant PS as PlazoService
    participant MR as MotivosRepo
    participant REPO as DevolucionesRepo
    participant DB as PostgreSQL

    UI->>MR: GET /api/devoluciones/motivos (paso 3)
    MR-->>UI: los 4 motivos activos
    E->>UI: elige ítems, cantidades, condición, motivo y observaciones, y confirma
    UI->>DR: POST /api/devoluciones {factura_numero, items[item_id, cantidad, condicion], motivo_id, observaciones}
    DR->>RS: registrarDevolucion(body)
    RS->>RS: validarPedido(body)
    alt pedido inválido
        RS-->>UI: 400 ("Seleccione un motivo", observaciones > 300, ítem repetido, cantidad <= 0...)
    end
    RS->>MR: buscarActivo(motivo_id)
    alt motivo inexistente o desactivado
        RS-->>UI: 400 "El motivo no es válido."
    end
    RS->>CS: facturaDisponible(numero)
    CS->>F: GET /api/facturas/:numero
    F-->>CS: factura
    alt anulada / no existe / anulación pendiente
        CS-->>UI: 404 / 409
    end
    RS->>PS: plazoDeComprobante(fecha)
    alt fuera de plazo
        RS-->>UI: 422 "La compra está fuera del plazo de devolución."
    end
    RS->>REPO: registrar(factura_numero, construir)
    REPO->>DB: BEGIN
    REPO->>DB: pg_advisory_xact_lock(factura) (espera si otro registra la misma factura)
    REPO->>DB: SUM(cantidad) ya devuelta por item (sin RECHAZADAS)
    DB-->>REPO: yaDevuelto
    REPO->>RS: construir(yaDevuelto)
    RS->>RS: construirDevolucion: valida cantidades, calcula tipo y monto
    alt más de lo comprado
        RS-->>REPO: error 422
        REPO->>DB: ROLLBACK
        REPO-->>UI: 422 "No se puede devolver más unidades de las compradas"
    else válido
        RS-->>REPO: datos (TOTAL o PARCIAL, monto_total) + items
        REPO->>DB: INSERT devoluciones (sin código)
        Note over DB: trigger trg_devoluciones_codigo:<br/>UPDATE correlativos SET ultimo = ultimo + 1<br/>codigo = DEV-000124
        REPO->>DB: INSERT devolucion_items (factura_item_id, condicion...)
        REPO->>DB: COMMIT
        DB-->>REPO: fila con código DEV-000124
        REPO-->>RS: devolución registrada
        RS-->>DR: detalle
        DR-->>UI: 201 "Devolución DEV-000124 registrada."
        UI-->>E: confirmación con el código DEV-000124
    end
```

## Notas

- Si algo falla después del `INSERT` (por ejemplo un ítem inválido), el `ROLLBACK` deshace también el correlativo: no quedan huecos en los códigos `DEV-`.
- El bloqueo es por factura: dos devoluciones de facturas distintas se registran en paralelo; dos de la misma factura, una después de la otra, así nunca se devuelve dos veces la misma unidad.
- El código no se puede editar después (trigger `trg_devoluciones_codigo_inmutable`, TDSI-1111).
