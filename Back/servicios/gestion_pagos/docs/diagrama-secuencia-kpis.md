# Diagrama de secuencia · Cálculo y despliegue del Tablero de KPIs (pestaña "Ventas")

TDSI-652 (historia TDSI-640). El Administrador abre **Inicio > "Tablero de KPIs"** (`/admin/kpis`) en la pestaña **Ventas** (TDSI-653) o cambia un filtro: Periodo, Caja o Cajero.

Gestión de pagos calcula las 5 tarjetas:
- KPI-1, KPI-2, KPI-5 y KPI-8 salen de sus propias tablas;
- KPI-6 se lee de las metas de venta de Gestión de caja.

La pantalla dibuja las tarjetas con su semáforo y los 3 gráficos. Las pestañas **Caja** y **Devoluciones y soporte** (TDSI-639) siguen el mismo flujo contra `gestion_caja` `/api/kpis/caja` y `/api/kpis/devoluciones-soporte`.

```mermaid
sequenceDiagram
    autonumber
    actor A as Administrador
    participant F as Frontend<br/>SeccionVentas.jsx
    participant R as gestion_pagos<br/>GET /api/kpis/ventas
    participant S as kpisVentasService
    participant DB as kpisVentasRepo<br/>pagos.*
    participant GC as gestion_caja<br/>GET /api/metas?fecha=
    participant D as kpisVentas<br/>(fórmulas puras)

    A->>F: Abre la pestaña Ventas o cambia Periodo, Caja o Cajero (PA TDSI-664)
    F->>R: GET /api/kpis/ventas?desde&hasta&caja_id&cajero_id
    R->>S: kpisVentas(query)
    S->>S: validarFiltros: AAAA-MM-DD, sin fechas = mes en curso,<br/>máx. 366 días; mes anterior = mes calendario anterior a desde
    alt filtro inválido
        S-->>F: 400 con el motivo (no consulta nada)
        F-->>A: Mensaje de error en los filtros
    else filtros válidos
        par consultas en paralelo
            S->>DB: ventasCobradasPorDia(periodo) y (mes anterior)
            Note over DB: CTE_HISTORIAL del historial de cajeros (TDSI-19/33):<br/>una venta = un id_transaccion, solo APROBADAS
            DB-->>S: [{ fecha, cantidad, monto }]
        and
            S->>DB: anulacionPorCajero(periodo)
            DB-->>S: [{ cajero_id, emitidas, anuladas, monto_anulado }]
        and
            S->>DB: montosPorMetodo(periodo) y (mes anterior)
            Note over DB: el mismo cálculo de GET /api/pagos/metodos (TDSI-34)
            DB-->>S: [{ metodo, monto, cantidad }]
        and
            S->>DB: canceladasPorMotivo(periodo)
            Note over DB: pagos.ventas_canceladas (TDSI-45)
            DB-->>S: [{ motivo, cantidad, monto }]
        and
            S->>GC: obtenerMetasDelDia(hasta)
            alt Gestión de caja responde
                GC-->>S: [{ caja_id, vendido, meta, porcentaje }]
            else no responde
                GC-->>S: error (solo KPI-6 queda "Sin datos")
            end
        end
        S->>D: calcularTicketPromedio · calcularTasaAnulacion ·<br/>calcularMixMetodos · calcularCumplimientoMeta · calcularTasaCanceladas
        D->>D: valor, semáforo (En meta / Atención / Fuera de meta /<br/>Referencia / Sin datos), detalle, fórmula y meta exactas
        D-->>S: 5 tarjetas con por_dia, por_cajero, metodos, por_caja y por_motivo
        S-->>R: { filtros, mes_anterior, kpis, avisos }
        R-->>F: 200 { ok: true, data }
        F->>F: TarjetaKpi × 5 (Chip del semáforo, botón "Fórmula")
        F->>F: Gráficos: ticket promedio por día (línea),<br/>anulación por cajero (barras), métodos de pago (dona)
        F-->>A: Tablero actualizado
    end
```

## Qué calcula cada paso

| Paso | Archivo | Qué hace |
|---|---|---|
| Ruta | `src/routes/kpisVentasRoutes.js` | `GET /api/kpis/ventas` responde `{ ok, data }`. Los errores van al `errorHandler` |
| Servicio | `src/services/kpisVentasService.js` | Valida los filtros, arma el mes anterior, pide todo en paralelo y junta la respuesta. Si Gestión de caja falla, la pestaña no se cae |
| Datos | `src/data/kpisVentasRepo.js` | SQL sobre `pagos.transacciones`, `pagos.pagos_mixtos` y `pagos.ventas_canceladas`, reutilizando `CTE_HISTORIAL` y `metodosPagoRepo` |
| Metas | `src/services/metasCajaProxy.js` | `GET {GESTION_CAJA_URL}/api/metas?fecha=` (TDSI-58), con tiempo límite de 5 s |
| Fórmulas | `src/domain/kpisVentas.js` | Funciones puras con las fórmulas, metas y semáforos de la presentación de KPIs (TDSI-649) |

Las fórmulas, las reglas y su validación con datos están en [`kpis-ventas.md`](kpis-ventas.md).
