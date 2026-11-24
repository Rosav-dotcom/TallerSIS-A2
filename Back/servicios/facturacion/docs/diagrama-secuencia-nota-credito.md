# Diagrama de secuencia · Nota de crédito → Pub/Sub → Contabilidad

TDSI-1020 (historia TDSI-73). Cómo se emite la nota de crédito de una devolución, cómo llega al Módulo de Contabilidad (Grupo D) por Google Pub/Sub y cómo vuelve el acuse con el número de asiento, incluidos los reintentos y el error.

La nota de crédito es un documento de **Facturación** (un dato, un dueño): Devoluciones la pide y guarda solo su número. El envío reutiliza lo mismo que las facturas (TDSI-22/52): la tabla `facturacion.factura_envios_contabilidad`, el publicador, el worker de reintentos y el "Reenviar".

## 1. Emitir y publicar

```mermaid
sequenceDiagram
    autonumber
    actor E as Encargado de Devoluciones
    participant UI as Front: confirmación
    participant DEV as Devoluciones :4008
    participant NCS as Facturación: NotasCreditoService
    participant REPO as NotasCreditoRepo
    participant CS as ContabilidadService
    participant DB as PostgreSQL
    participant PS as Google Pub/Sub (tópico Grupo D)

    E->>UI: "Emitir nota de crédito"
    UI->>DEV: POST /api/devoluciones/DEV-000123/nota-credito {usuario}
    DEV->>DEV: bloquea la devolución (no RECHAZADA, sin nota previa)
    DEV->>NCS: POST /api/notas-credito {factura, devolucion_codigo, items, monto, motivo}
    NCS->>REPO: crear(pedido, verificar)
    REPO->>DB: BEGIN · factura FOR UPDATE · SUM(notas EMITIDAS)
    alt monto > total - ya emitido
        REPO-->>NCS: 422 "No se puede emitir... por más del total de la factura."
        NCS-->>DEV: 422
        DEV-->>UI: 422 (no se guarda nada)
    else dentro del total
        REPO->>DB: NC-NNNNNN (advisory lock) · INSERT nota + ítems · COMMIT
        Note over DB: trg_notas_credito_tope también lo verifica
        NCS->>CS: enviarNotaCreditoSeguro(nota)
        CS->>DB: ¿la venta de la factura ya se envió? (si nunca se envió, se envía primero)
        CS->>DB: INSERT envío 'nota_credito' (Pendiente, payload)
        CS->>PS: publicar {referencia_externa: NC-000045, tipo_operacion: nota_credito, datos}
        alt Pub/Sub confirma
            PS-->>CS: messageId
            CS->>DB: envío Enviado
        else falla
            CS->>DB: envío Pendiente (reintentable) o Error
        end
        NCS-->>DEV: 201 nota + contabilidad
        DEV->>DEV: guarda la referencia NC-000045 · COMMIT
        DEV-->>UI: 201 "Nota de crédito NC-000045 emitida."
        UI-->>E: tarjeta "Enviado a Contabilidad" · "Ver PDF"
    end
```

## 2. Reintentos y error

```mermaid
sequenceDiagram
    autonumber
    participant W as Worker de reintentos (cada CONTABILIDAD_INTERVALO_WORKER_SEG)
    participant CS as ContabilidadService
    participant DB as PostgreSQL
    participant PS as Google Pub/Sub
    actor A as Administrador / Encargado

    loop envíos Pendientes vencidos (FOR UPDATE SKIP LOCKED)
        W->>DB: tomarPendientes()
        W->>CS: intentarEnvio(envío nota_credito)
        alt la venta todavía no llegó a Contabilidad
            CS->>DB: posponer (sin gastar intentos)
        else
            CS->>PS: publicar (idempotency_key nota-credito-<id>)
            alt ok
                CS->>DB: Enviado
            else error reintentable (p. ej. UNAVAILABLE)
                CS->>DB: Pendiente, intentos + 1, espera base·2^n
            else error no reintentable o sin intentos (CONTABILIDAD_MAX_INTENTOS)
                CS->>DB: Error + ultimo_error
            end
        end
    end
    Note over A: la tarjeta muestra "Error al enviar a Contabilidad" y "Reenviar"
    A->>CS: POST /api/facturas/envios-contabilidad/:id/reenviar
    CS->>DB: nuevo ciclo de intentos
    CS->>PS: publicar
    PS-->>CS: messageId
    CS->>DB: Enviado
```

## 3. Acuse de Contabilidad

```mermaid
sequenceDiagram
    autonumber
    participant C as Módulo de Contabilidad (Grupo D)
    participant PS as Pub/Sub (tópico Grupo A)
    participant J as Lector de respuestas (CONTABILIDAD_RESPUESTAS_SUBSCRIPTION)
    participant RCS as RespuestasContabilidadService
    participant DB as PostgreSQL
    actor E as Encargado

    C->>PS: resultado_documento {referencia_externa: NC-000045, estado, numero_asiento, motivo}
    J->>PS: leer (pull)
    J->>RCS: procesarMensaje
    alt referencia NC-... de una nota de esta base
        RCS->>DB: registrarResultadoNota (resultado, numero_asiento, motivo)
        J->>PS: ack
    else no es nuestro
        J->>PS: liberar (lo toma quien más lea la suscripción)
    end
    E->>DB: GET /api/notas-credito/NC-000045
    Note over E: "Aceptado" · Asiento 1025 (o "Rechazado" con el motivo)
```

## Estados que ve la tarjeta "Nota de crédito"

| Envío | Resultado | Texto |
|---|---|---|
| sin envío (sin tópico) | — | No enviado a Contabilidad |
| Pendiente | — | Enviando a Contabilidad |
| Enviado | — | Enviado a Contabilidad |
| Enviado | aceptado | Aceptado (con N.º de asiento) |
| Enviado | rechazado | Rechazado (con el motivo) |
| Error | — | Error al enviar a Contabilidad · botón "Reenviar" |
