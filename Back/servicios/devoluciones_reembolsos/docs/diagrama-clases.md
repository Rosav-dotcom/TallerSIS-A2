# Diagrama de clases · Microservicio Devoluciones y reembolsos

TDSI-1003 (historia TDSI-70). Microservicio `devoluciones_reembolsos` (puerto 4008), del Encargado de Devoluciones. Muestra cómo se busca el comprobante original en Facturación (TDSI-68), se valida el plazo en días hábiles (TDSI-69) y se registra la devolución con su código `DEV-NNNNNN` (TDSI-70 y TDSI-76).

Las "clases" son módulos de Node.js (CommonJS): cada uno exporta funciones y recibe lo que necesita por `require`. Las entidades de abajo son las tablas del esquema `devoluciones` (`sql/script_devoluciones.sql`).

## Capas

```mermaid
classDiagram
    direction LR

    class DevolucionesRoutes {
        <<router /api/devoluciones>>
        +GET / ?codigo&estado&desde&hasta
        +POST /
        +GET /:codigo
    }
    class ComprobantesRoutes {
        <<router /api/devoluciones/comprobantes>>
        +GET / ?q
        +GET /:numero
        +GET /:numero/plazo
        +GET /:numero/opciones-reembolso
    }
    class ConfiguracionRoutes {
        <<router /api/devoluciones/configuracion>>
        +GET /plazo
    }
    class MotivosRoutes {
        <<router /api/devoluciones/motivos>>
        +GET /
    }

    class RegistroService {
        +registrarDevolucion(body) DetalleDevolucion
        +validarPedido(body) Pedido
        +construirDevolucion(factura, pedido, plazo, yaDevuelto) NuevaDevolucion
    }
    class DevolucionesService {
        +listarDevoluciones(codigo, estado, desde, hasta) ResumenDevolucion[]
        +obtenerDevolucion(codigo) DetalleDevolucion
        +aDetalle(fila) DetalleDevolucion
    }
    class ComprobantesService {
        +buscarComprobantes(q) ResultadoBusqueda
        +obtenerComprobante(numero) Comprobante
        +obtenerPlazo(numero) Plazo
        +facturaDisponible(numero) Factura
    }
    class OpcionesReembolsoService {
        +OPCIONES : Efectivo, Reversión electrónica, Vale
        +calcularOpciones(metodos, reglas) Opcion[]
        +opcionesDeFactura(factura) OpcionesReembolso
    }
    class PlazoService {
        +plazoDeComprobante(fechaEmision, plazoDias, hoy) Plazo
    }
    class ConfiguracionService {
        +PLAZO_POR_DEFECTO = 7
        +obtenerPlazoDias() PlazoConfigurado
    }

    class DevolucionesRepo {
        +crear(datos, items) Devolucion
        +registrar(facturaNumero, construir) Devolucion
        +buscarPorCodigo(codigo) Devolucion
        +listar(filtros) Devolucion[]
        -insertar(cliente, datos, items)
        -enTransaccion(trabajo)
    }
    class ConfiguracionRepo {
        +obtener(clave) Configuracion
    }
    class ReglasReembolsoRepo {
        +reglasDe(metodos) ReglaReembolso[]
    }
    class MotivosRepo {
        +listarActivos() Motivo[]
        +buscarActivo(id) Motivo
    }
    class FacturacionClient {
        -FACTURACION_URL
        +buscarFacturas(q) ResultadoFacturacion
        +obtenerFactura(numero) Factura
    }

    class DiasHabiles {
        <<utilidad, America/La_Paz>>
        +diaLocal(fecha) string
        +esHabil(dia) boolean
        +diasHabilesEntre(desde, hasta) number
        +sumarDiasHabiles(dia, n) string
        +evaluarPlazo(fechaEmision, plazoDias, hoy) Plazo
    }
    class CodigoDevolucion {
        <<utilidad>>
        +formatearCodigo(n) string
        +normalizarCodigo(texto) string
    }
    class AppError {
        +message : string
        +status : number
        +detalle : any
    }
    class ErrorHandler {
        <<middleware>>
        +errorHandler(err, req, res, next)
    }
    class Db {
        <<pg Pool>>
        +pool
        +query(sql, params)
    }
    class Facturacion {
        <<microservicio externo :4002>>
        GET /api/facturas/buscar?q
        GET /api/facturas/:numero
    }

    DevolucionesRoutes --> DevolucionesService
    DevolucionesRoutes --> RegistroService
    ComprobantesRoutes --> ComprobantesService
    ConfiguracionRoutes --> ConfiguracionService
    MotivosRoutes --> MotivosRepo

    RegistroService --> ComprobantesService : facturaDisponible
    RegistroService --> PlazoService
    RegistroService --> MotivosRepo : buscarActivo
    RegistroService --> OpcionesReembolsoService : opcion permitida
    ComprobantesService --> OpcionesReembolsoService
    OpcionesReembolsoService --> ReglasReembolsoRepo
    RegistroService --> DevolucionesRepo : registrar
    RegistroService --> DevolucionesService : aDetalle
    DevolucionesService --> DevolucionesRepo
    DevolucionesService --> CodigoDevolucion
    ComprobantesService --> FacturacionClient
    ComprobantesService --> PlazoService
    ComprobantesService --> ConfiguracionService
    PlazoService --> DiasHabiles
    PlazoService --> ConfiguracionService
    ConfiguracionService --> ConfiguracionRepo

    DevolucionesRepo --> Db
    ConfiguracionRepo --> Db
    MotivosRepo --> Db
    ReglasReembolsoRepo --> Db
    FacturacionClient ..> Facturacion : HTTP

    RegistroService ..> AppError : lanza
    ComprobantesService ..> AppError : lanza
    DevolucionesService ..> AppError : lanza
    FacturacionClient ..> AppError : lanza
    ErrorHandler ..> AppError : responde status y mensaje
```

## Entidades (esquema `devoluciones`)

```mermaid
classDiagram
    direction LR

    class Devolucion {
        <<devoluciones.devoluciones>>
        +id : bigint
        +codigo : DEV-NNNNNN unico, no editable
        +factura_numero : string
        +venta_id : string
        +cliente_nit : string
        +fecha_venta : timestamptz
        +fecha_solicitud : timestamptz
        +dentro_de_plazo : boolean
        +tipo : TOTAL o PARCIAL
        +motivo_id : bigint
        +observaciones : string 300
        +metodo_pago_original : string
        +opcion_reembolso : EFECTIVO, REVERSION_TARJETA o VALE
        +monto_total : numeric
        +estado : PENDIENTE, APROBADA, RECHAZADA o PROCESADA
        +motivo_rechazo : string
        +requiere_autorizacion : boolean
        +autorizado_por : string
        +envio_comprobante_id : string
        +creado_por : string
    }
    class DevolucionItem {
        <<devoluciones.devolucion_items>>
        +factura_item_id : bigint
        +codigo_producto : string
        +descripcion : string
        +cantidad : numeric
        +precio_unitario : numeric
        +subtotal : numeric
        +condicion : REINGRESO o MERMA
    }
    class Correlativo {
        <<devoluciones.correlativos>>
        +nombre : devolucion
        +ultimo : bigint
    }
    class Configuracion {
        <<devoluciones.configuracion>>
        +clave : plazo_dias_habiles
        +valor : 1 a 60, por defecto 7
        +actualizado_en
        +actualizado_por
    }
    class Motivo {
        <<devoluciones.motivos>>
        +nombre : Producto vencido, Empaque dañado, Error de cobro o Cambio de producto
        +activo
        +orden
    }
    class ReglaReembolso {
        <<devoluciones.reglas_reembolso>>
        +metodo_pago : Efectivo, Tarjeta o QR
        +opcion : EFECTIVO, REVERSION_TARJETA o VALE
        +permitido : boolean
        +explicacion : texto del tooltip
    }
    class HistorialEstado {
        <<devoluciones.historial_estados>>
        +estado_anterior
        +estado_nuevo
        +cambiado_por
        +cambiado_en
    }
    class Reembolso {
        <<devoluciones.reembolsos>>
        +tipo : EFECTIVO, REVERSION_TARJETA, REVERSION_QR o VALE
        +monto
        +estado
        +referencia : id en gestion_pagos
    }
    class NotaCredito {
        <<devoluciones.notas_credito>>
        +numero
        +monto
        +estado
    }
    class NotificacionInventario {
        <<devoluciones.notificaciones_inventario>>
        +estado
        +enviado_en
    }

    Devolucion "1" *-- "1..*" DevolucionItem : items
    Devolucion "1" *-- "0..*" HistorialEstado : TDSI-81
    Devolucion "1" *-- "0..*" Reembolso : TDSI-72 y 74
    Devolucion "1" *-- "0..*" NotaCredito : TDSI-73
    Devolucion "1" *-- "0..*" NotificacionInventario : TDSI-77
    Devolucion "0..*" --> "0..1" Motivo : TDSI-71
    Correlativo ..> Devolucion : trigger trg_devoluciones_codigo
    ReglaReembolso ..> Devolucion : opcion_reembolso permitida
```

## Reglas que viven en la base de datos

| Regla | Dónde |
|---|---|
| El código `DEV-NNNNNN` lo pone la BD al insertar, seguido y sin huecos | trigger `trg_devoluciones_codigo` + tabla `correlativos` (TDSI-229) |
| El código es único, con formato fijo y no se puede editar | `UNIQUE`, `CHECK devoluciones_codigo_formato` y trigger `trg_devoluciones_codigo_inmutable` (TDSI-1111) |
| El plazo es un entero de 1 a 60 | `CHECK configuracion_plazo_valido` (TDSI-1097) |
| Una opción de reembolso bloqueada siempre explica por qué | `CHECK (permitido OR explicacion IS NOT NULL)` en `reglas_reembolso` (TDSI-221) |
| Las observaciones tienen hasta 300 caracteres | `VARCHAR(300)`; el servicio responde 400 antes de llegar a la BD (TDSI-1009) |
| No se devuelve dos veces la misma unidad | `DevolucionesRepo.registrar` bloquea la factura con `pg_advisory_xact_lock` mientras suma lo ya devuelto (TDSI-1001) |

Los vales, la reversión con tarjeta y el correo del comprobante los hace `gestion_pagos` (acuerdo de equipo, contrato TDSI-1027): Devoluciones solo guarda la referencia (`reembolsos.referencia`, `devoluciones.envio_comprobante_id`).
