# Diagrama de secuencia · Aviso a Inventario por Pub/Sub

TDSI-1043 (historia TDSI-77). Qué pasa desde que el Encargado de Devoluciones da por **procesada** una devolución hasta que Inventario confirma (o rechaza) el reingreso o la baja de los productos. Los nombres son los módulos reales de `devoluciones_reembolsos` (ver [diagrama-clases.md](diagrama-clases.md)); el formato de los mensajes está en [contrato-inventario.md](contrato-inventario.md).

Ideas clave:

- **Bandeja de salida (outbox).** El cambio a `PROCESADA` y el aviso (`PENDIENTE`, con el mensaje ya armado) se guardan en la misma transacción. Recién después se publica: si Pub/Sub falla, la devolución igual queda procesada y el aviso no se pierde.
- **Reintentos.** Un worker reintenta los avisos pendientes hasta 5 veces, con espera creciente (30, 60, 120 y 240 s). Después el aviso queda en `ERROR` y se puede **Reenviar**.
- **Idempotencia.** Una devolución tiene un solo aviso. Cada envío lleva `mensaje_id = DEV-<codigo>-<version>` (también en el atributo `idempotency_key`): los reintentos repiten el mismo, y **Reenviar** sube la versión para que Inventario lo tome como un aviso nuevo.
- **Acuses.** Inventario responde en el tópico del Grupo A. La suscripción la comparten Facturación y Gestión de pagos, así que cada servicio confirma (ack) solo lo suyo y libera lo demás.

## 1. Procesar la devolución y publicar el aviso (TDSI-231)

```mermaid
sequenceDiagram
    autonumber
    actor E as Encargado de Devoluciones
    participant UI as Front: DetalleDevolucion
    participant DR as DevolucionesRoutes
    participant PR as ProcesoService
    participant REPO as DevolucionesRepo
    participant NR as NotificacionesInventarioRepo
    participant IS as InventarioService
    participant PUB as PubSubPublisher
    participant PS as Google Pub/Sub
    participant DB as PostgreSQL

    E->>UI: "Procesar devolución"
    UI->>DR: POST /api/devoluciones/DEV-000123/procesar { usuario }
    DR->>PR: procesarDevolucion(codigo, usuario)
    PR->>REPO: procesar(codigo, usuario, validar, armarPayload)
    REPO->>DB: BEGIN · SELECT devolución FOR UPDATE
    REPO->>PR: validar(fila)
    alt RECHAZADA o ya PROCESADA
        REPO-->>UI: 409 "ya fue procesada" / "está RECHAZADA" (no se avisa a Inventario)
    else PENDIENTE o APROBADA
        REPO->>DB: SELECT ítems · UPDATE estado = PROCESADA (trigger: historial con usuario y hora)
        REPO->>IS: armarPayload → armarMensaje(devolucion, items, version 1)
        IS-->>REPO: devolucion_stock, mensaje_id DEV-000123-1
        REPO->>NR: crearEnTransaccion(devolucion_id, payload)
        NR->>DB: INSERT notificaciones_inventario (PENDIENTE)
        REPO->>DB: COMMIT
        PR->>IS: enviarSeguro(aviso, payload)
        IS->>PUB: publicar(payload, atributos idempotency_key, tipo, origen, grupo)
        PUB->>PS: publishMessage(topico de Inventario)
        alt publicado
            PS-->>PUB: messageId
            IS->>NR: marcarEnviado(id, messageId)
            NR->>DB: estado ENVIADO, intentos 1
        else Pub/Sub no responde (UNAVAILABLE, tiempo agotado)
            IS->>NR: registrarFallo(id, reintentable)
            NR->>DB: sigue PENDIENTE, intentos 1, proximo_intento_en = ahora + 30 s
        else error que no se arregla reintentando (permisos, tópico inexistente)
            IS->>NR: registrarFallo(id, no reintentable)
            NR->>DB: estado ERROR
        else INVENTARIO_PUBSUB_TOPIC vacío
            IS->>NR: posponer(id) sin gastar intentos
        end
        PR-->>UI: 200 detalle (obtenerDevolucion) con inventario { estado, texto, intentos, puede_reenviar }
    end
    UI-->>E: chip "Enviado" / "Pendiente" / "Error" en la columna Inventario (PA TDSI-1044)
```

## 2. Reintentos del worker (TDSI-1039)

```mermaid
sequenceDiagram
    autonumber
    participant W as Job reintentoInventario (cada 15 s)
    participant NR as NotificacionesInventarioRepo
    participant IS as InventarioService
    participant PS as Google Pub/Sub
    participant DB as PostgreSQL

    loop cada INVENTARIO_INTERVALO_WORKER_SEG
        W->>NR: tomarPendientes(10)
        NR->>DB: PENDIENTE con proximo_intento_en vencido · FOR UPDATE SKIP LOCKED
        Note over NR,DB: dos instancias del servicio no toman el mismo aviso
        DB-->>NR: avisos (con su payload guardado)
        loop por cada aviso
            W->>IS: intentarEnvio(aviso)
            IS->>PS: mismo mensaje, mismo mensaje_id
            alt publicado
                IS->>NR: marcarEnviado → ENVIADO
            else falla e intentos < 5
                IS->>NR: registrarFallo → PENDIENTE, espera 30·2^(intento-1) s
            else quinto intento fallido
                IS->>NR: registrarFallo → ERROR (ya no se reintenta)
            end
        end
    end
```

## 3. Acuse de Inventario (TDSI-1040)

```mermaid
sequenceDiagram
    autonumber
    participant INV as Inventario (otro grupo)
    participant PS as Google Pub/Sub
    participant J as Job acusesInventario (cada 30 s)
    participant SUB as PubSubSubscriber
    participant AS as AcusesInventarioService
    participant NR as NotificacionesInventarioRepo
    participant DB as PostgreSQL

    PS->>INV: devolucion_stock DEV-000123-1
    INV->>INV: reingresa (REINGRESO) o da de baja (MERMA) el stock
    INV->>PS: acuse_devolucion_stock { referencia_externa, mensaje_id, estado, motivo }
    J->>SUB: leer(50, ucb-sis323-sub-a-sub)
    SUB->>PS: pull
    PS-->>SUB: mensajes del tópico del Grupo A
    loop por cada mensaje
        J->>AS: procesarMensaje(texto)
        AS->>AS: interpretar (INVENTARIO, acuse_devolucion_stock, DEV-..., confirmado/rechazado)
        alt no es un acuse o la devolución no es de esta base
            AS-->>J: propio = false
        else acuse de una versión anterior (antes de un Reenviar)
            AS-->>J: propio = true, ignorado
        else acuse vigente
            AS->>NR: registrarAcuse(id, CONFIRMADO o RECHAZADO, motivo)
            NR->>DB: estado, resultado_motivo, resultado_en
            AS-->>J: propio = true
        end
    end
    J->>SUB: confirmar(ack de los propios)
    J->>SUB: liberar(los demás, para Facturación y Gestión de pagos)
    Note over DB: el detalle muestra "Confirmado" (PA TDSI-1045) o "Rechazado" con el motivo y el botón Reenviar (PA TDSI-1046)
```

## 4. Reenviar (TDSI-1041)

```mermaid
sequenceDiagram
    autonumber
    actor E as Encargado de Devoluciones
    participant UI as Front: DetalleDevolucion
    participant DR as DevolucionesRoutes
    participant IS as InventarioService
    participant NR as NotificacionesInventarioRepo
    participant PS as Google Pub/Sub
    participant DB as PostgreSQL

    E->>UI: "Reenviar" (visible si puede_reenviar)
    UI->>DR: POST /api/devoluciones/DEV-000123/inventario/reenviar
    DR->>IS: reenviar(codigo)
    IS->>NR: prepararReenvio(id)
    NR->>DB: UPDATE ... WHERE estado IN (ERROR, RECHAZADO): version + 1, intentos 0, mensaje_id DEV-000123-2
    alt no estaba en Error ni Rechazado (o dos clics a la vez)
        IS-->>UI: 409 "Solo se reenvía un aviso en Error o Rechazado"
    else preparado
        IS->>PS: devolucion_stock DEV-000123-2
        IS->>NR: marcarEnviado / registrarFallo (vuelve al ciclo de reintentos)
        DR-->>UI: 200 "Aviso de DEV-000123 reenviado a Inventario."
    end
    UI-->>E: chip actualizado (PA TDSI-1047)
```

## Estados del aviso

```mermaid
stateDiagram-v2
    [*] --> PENDIENTE : procesar (outbox)
    PENDIENTE --> ENVIADO : publicado
    PENDIENTE --> PENDIENTE : falla, intentos < 5
    PENDIENTE --> ERROR : 5 intentos o error no reintentable
    ENVIADO --> CONFIRMADO : acuse confirmado
    ENVIADO --> RECHAZADO : acuse rechazado (motivo)
    PENDIENTE --> CONFIRMADO : acuse que llega aunque figure pendiente
    ERROR --> CONFIRMADO : acuse que llega aunque figure en error
    ERROR --> PENDIENTE : Reenviar (version + 1)
    RECHAZADO --> PENDIENTE : Reenviar (version + 1)
    CONFIRMADO --> [*]
```
