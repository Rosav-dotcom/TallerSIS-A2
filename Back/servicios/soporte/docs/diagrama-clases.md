# Diagrama de clases · Microservicio Soporte

TDSI-974 (historia TDSI-63). Muestra cómo el Usuario de Soporte consulta en **solo lectura** la factura (Facturación) y la transacción (Gestión de pagos), las compara y marca las diferencias. `Incidente` es la tabla `soporte.incidentes` (TDSI-971) donde se registra el hallazgo.

Las "clases" son módulos de Node.js: cada `crearX()` es una fábrica que recibe sus dependencias, así en los tests se reemplazan por datos simulados.

```mermaid
classDiagram
    direction LR

    class SoporteRoutes {
        <<router /api/soporte>>
        +GET facturas/:numero
        +GET transacciones/:id
        +GET comparacion?factura&transaccion
    }

    class FacturasService {
        +consultarFactura(numero) VistaFactura
    }
    class TransaccionesService {
        +consultarTransaccion(id) VistaTransaccion
    }
    class ComparacionService {
        +comparar(factura, transaccion) ResultadoComparacion
    }
    class CompararFacturaYTransaccion {
        <<función pura>>
        +compararFacturaYTransaccion(factura, transaccion, idBuscado) ResultadoComparacion
        +normalizarTexto(texto) string
    }

    class FacturacionClient {
        -baseUrl : FACTURACION_URL
        +obtenerFactura(numero) Factura
    }
    class GestionPagosClient {
        -baseUrl : GESTION_PAGOS_URL
        -clientId : GESTION_PAGOS_CLIENT_ID
        -clientSecret : GESTION_PAGOS_CLIENT_SECRET
        -token : valor, venceEn
        -obtenerToken() string
        -getConToken(ruta) JSON
        +obtenerTransaccion(id) Transaccion
        +obtenerHistorial(id) CambioEstado[]
    }
    class Http {
        <<utilidad>>
        +pedirJson(url, opciones) JSON
    }
    class AppError {
        +mensaje : string
        +status : number
        +detalle : any
        +statusOrigen : number
    }

    class Facturacion {
        <<microservicio externo :4002>>
        GET /api/facturas/:numero
    }
    class GestionPagos {
        <<microservicio externo :4005>>
        POST /auth/token
        GET /transacciones/:id
        GET /transacciones/:id/historial
    }

    class VistaFactura {
        +numero : string
        +venta_id : string
        +fecha : fecha
        +estado : Borrador / Emitida / AnulacionSolicitada / Anulada
        +cliente : nit, nombre
        +subtotal : number
        +descuento : number
        +impuesto : number
        +total : number
        +items : Item[]
        +metodos_pago : MetodoMonto[]
    }
    class VistaTransaccion {
        +id_transaccion : string
        +fecha : fecha
        +tipo_pago : Simple / Mixto
        +estado : Registrado / Anulado
        +estado_pago : PENDIENTE / APROBADA / RECHAZADA
        +total : number
        +metodos : MetodoMonto[]
        +cliente : nit, razon_social, tipo_documento
        +caja_id : string
        +cajero : string
        +historial : CambioEstado[]
    }
    class MetodoMonto {
        +metodo : Efectivo / Tarjeta / QR
        +monto : number
    }
    class ResultadoComparacion {
        +factura : VistaFactura
        +transaccion : VistaTransaccion
        +coincide : boolean
        +diferencias : Diferencia[]
        +avisos : string[]
    }
    class Diferencia {
        +campo : string
        +factura : any
        +transaccion : any
        +mensaje : string
    }

    class Incidente {
        <<tabla soporte.incidentes>>
        +id : bigint
        +numero : INC-000001
        +tipo : Facturacion / Pagos / Acceso / Error del sistema / Otro
        +referencia_tipo : factura / transaccion
        +referencia : string
        +descripcion : text
        +estado : Abierto / En proceso / Pendiente / Resuelto / Cerrado / Escalado
        +prioridad : Baja / Media / Alta / Critica
        +usuario_afectado : string
        +registrado_por : string
        +creado_en : timestamptz
        +actualizado_en : timestamptz
        +resuelto_en : timestamptz
        +cerrado_en : timestamptz
    }

    SoporteRoutes --> FacturasService
    SoporteRoutes --> TransaccionesService
    SoporteRoutes --> ComparacionService
    ComparacionService --> FacturasService
    ComparacionService --> TransaccionesService
    ComparacionService ..> CompararFacturaYTransaccion : usa
    FacturasService --> FacturacionClient
    TransaccionesService --> GestionPagosClient
    FacturacionClient ..> Http
    GestionPagosClient ..> Http
    Http ..> AppError : lanza
    FacturacionClient ..> Facturacion : HTTP solo lectura
    GestionPagosClient ..> GestionPagos : HTTP + token

    FacturasService ..> VistaFactura : crea
    TransaccionesService ..> VistaTransaccion : crea
    CompararFacturaYTransaccion ..> ResultadoComparacion : crea
    VistaFactura "1" *-- "0..*" MetodoMonto
    VistaTransaccion "1" *-- "1..*" MetodoMonto
    ResultadoComparacion "1" *-- "0..*" Diferencia
    ResultadoComparacion o-- VistaFactura
    ResultadoComparacion o-- "0..1" VistaTransaccion
    Incidente ..> VistaFactura : referencia (numero)
    Incidente ..> VistaTransaccion : referencia (id_transaccion)
```

## Cómo leerlo

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Rutas | `src/routes/soporteRoutes.js` | Recibe la petición y responde `{ ok, data }`; los errores van al `errorHandler` |
| Servicios | `src/services/*.js` | Validan la entrada (número de factura, ID de transacción) y arman la vista de solo lectura |
| Dominio | `src/domain/compararFacturaYTransaccion.js` | Reglas de comparación, sin base de datos ni red (TDSI-972, probadas en TDSI-973) |
| Clientes | `src/clients/*.js` | Llaman por HTTP a Facturación y Gestión de pagos; traducen sus fallas a `AppError` (404, 502, 503) |
| Base de datos | `sql/script_soporte.sql` | Tabla `incidentes`, la única que escribe Soporte |

Soporte **no** guarda copias de facturas ni de pagos: el incidente solo guarda la referencia (`referencia_tipo` + `referencia`) y los datos se vuelven a leer de sus dueños cuando se necesitan.
