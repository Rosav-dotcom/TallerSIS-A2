# KPIs de ventas · pestaña "Ventas" del Tablero de KPIs

TDSI-640. Este documento define las fórmulas (TDSI-649) y explica cómo comprobarlas a mano con datos reales. El endpoint es `GET /api/kpis/ventas` (TDSI-650).

Los nombres, las fórmulas y las metas son los de la presentación **"Tablero de KPIs de RePay"**, copiados igual que en `Frontend/docs/pantallas/sprint4/tablero-kpis.md`. El código de las fórmulas está en `src/domain/kpisVentas.js`: son funciones puras, sin base de datos.

## Reglas comunes

| Regla | Detalle |
|---|---|
| Periodo | `desde` y `hasta` en formato AAAA-MM-DD, ambos incluidos y en días de Bolivia. Sin fechas: el mes en curso hasta hoy. Máximo 366 días |
| Filtros | `caja_id` y `cajero_id` son opcionales y se aplican a todos los KPIs. Excepción: KPI-6 solo filtra por caja, porque las metas son por caja |
| "Mes anterior" | Es el mes calendario anterior al de `desde`, con los mismos filtros de caja y cajero. Si `desde` es 2026-11-10, el mes anterior es 2026-10-01 a 2026-10-31 |
| "Transacción" o "venta" | Una venta en caja es un `id_transaccion` de `pagos.transacciones` con `cajero_id`. Un pago mixto cuenta **una** vez, con su total. Marketplace no entra |
| Estado de la venta | Es el mismo que usa el historial de cajeros (TDSI-19/33, `CTE_HISTORIAL`): **APROBADA** si se cobró y no está anulada; **ANULADA** si todas sus filas están Anuladas; **RECHAZADA** o **PENDIENTE** según `estado_pago` |
| Semáforo | `En meta`, `Atención`, `Fuera de meta`, `Referencia` (sin meta fija) o `Sin datos` (no hay con qué calcular). Se elige con el valor que se muestra, a 1 decimal: si la tarjeta dice 2,0 %, está En meta aunque el valor exacto sea 2,04 % |
| Formato | Montos en Bs con 2 decimales; porcentajes con 1 decimal |

## KPI-1 · Ticket promedio

- **Fórmula:** Σ monto de transacciones Registradas ÷ N.º de transacciones Registradas.
- **Qué cuenta:** solo las ventas APROBADAS en caja. Las anuladas, rechazadas y pendientes no suman ni en el monto ni en la cantidad.
- **Semáforo:** compara el valor con el ticket promedio del mes anterior.
  - Si no baja: **En meta**.
  - Si baja hasta 10 %: **Atención**.
  - Si baja más de 10 %: **Fuera de meta**.
  - Si el mes anterior no tuvo ventas: **Referencia**.
- **Detalle:** "▲ 4,2 % vs. mes ant."
- **Gráfico:** `por_dia`, con el ticket promedio de cada día.

```sql
-- Cálculo manual de un día (PA TDSI-662). Cambie la fecha.
WITH ventas AS (
  SELECT id_transaccion, SUM(monto) AS total,
         bool_and(estado = 'Anulado') AS anulada,
         bool_or(estado_pago <> 'APROBADA') AS no_cobrada
    FROM pagos.transacciones
   WHERE cajero_id IS NOT NULL
     AND fecha >= ('2026-11-25'::date)::timestamp AT TIME ZONE 'America/La_Paz'
     AND fecha <  ('2026-11-25'::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
   GROUP BY id_transaccion
)
SELECT COUNT(*) AS transacciones, SUM(total) AS monto, ROUND(SUM(total) / COUNT(*), 2) AS ticket_promedio
  FROM ventas WHERE NOT anulada AND NOT no_cobrada;
```

## KPI-2 · Tasa de anulación por cajero

- **Fórmula:** Facturas Anuladas ÷ Facturas emitidas × 100 · Bs anulados = Σ total anulado.
- **Facturas emitidas:** en caja, cada venta cobrada emite su factura, y el N° de factura es el `id_transaccion`. Por eso, emitidas = APROBADAS + ANULADAS de cada cajero. Las rechazadas o pendientes nunca emitieron factura.
- **Fecha que se usa:** la de la venta, no la de la anulación.
- **Semáforo:** ≤ 2 % **En meta**; ≤ 5 % **Atención**; > 5 % **Fuera de meta**.
- **Detalle:** "6 de 326 facturas · Bs 1.234,00". Así se ve en cantidad y en Bs (PA TDSI-663).
- **Gráfico:** `por_cajero`, de mayor a menor tasa.

```sql
WITH ventas AS (
  SELECT id_transaccion, MAX(cajero_id) AS cajero_id, SUM(monto) AS total,
         bool_and(estado = 'Anulado') AS anulada, bool_or(estado_pago <> 'APROBADA') AS no_cobrada
    FROM pagos.transacciones
   WHERE cajero_id IS NOT NULL
     AND fecha >= ('2026-11-01'::date)::timestamp AT TIME ZONE 'America/La_Paz'
     AND fecha <  ('2026-11-30'::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
   GROUP BY id_transaccion
)
SELECT cajero_id,
       COUNT(*) FILTER (WHERE anulada OR NOT no_cobrada) AS emitidas,
       COUNT(*) FILTER (WHERE anulada)                   AS anuladas,
       COALESCE(SUM(total) FILTER (WHERE anulada), 0)    AS bs_anulados
  FROM ventas GROUP BY cajero_id ORDER BY cajero_id;
```

## KPI-5 · Mix de métodos de pago

- **Fórmula:** Σ monto del método ÷ Σ monto total cobrado × 100.
- **Origen:** reutiliza el monitoreo por método de pago (TDSI-34, `metodosPagoRepo.agruparPorMetodo`). Cada parte de un pago mixto suma en su método. Las ventas anuladas, rechazadas o pendientes no suman.
- **Siempre suma 100 %:** los 3 métodos (Efectivo, Tarjeta y QR) se redondean a 1 decimal repartiendo el resto, así nunca da 99,9 % ni 100,1 %.
- **Tarjeta:** la del mockup es "Pago en efectivo": su valor es el % de Efectivo.
- **Detalle:** "QR 30,0 % · Tarjeta 25,0 %".
- **Semáforo:** no tiene meta fija, se compara con el mes anterior. **Atención** si algún método cambió más de 10 puntos; si no, **Referencia**.
- **Gráfico:** dona con `metodos[].porcentaje`.

```sql
-- Debe dar lo mismo que GET /api/pagos/metodos?desde=&hasta= del mismo periodo
SELECT t.metodo, SUM(t.monto) AS monto
  FROM pagos.transacciones t
  LEFT JOIN pagos.pagos_mixtos pm ON pm.id = t.pago_mixto_id
 WHERE t.fecha >= ('2026-11-01'::date)::timestamp AT TIME ZONE 'America/La_Paz'
   AND t.fecha <  ('2026-11-30'::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
   AND t.id_transaccion IN (
       SELECT id_transaccion FROM pagos.transacciones
        GROUP BY id_transaccion HAVING bool_and(estado = 'Registrado' AND estado_pago = 'APROBADA'))
   AND COALESCE(pm.estado, 'Registrado') = 'Registrado'
 GROUP BY t.metodo;
```

## KPI-6 · Cumplimiento de meta de ventas

- **Fórmula:** Ventas del día de la caja ÷ Meta diaria de la caja × 100.
- **Origen:** se lee de **Metas de venta** de Gestión de caja (`GET /api/metas?fecha=`, TDSI-58) para el **último día del periodo** (`hasta`). Cada caja coincide con esa pantalla el mismo día (PA de TDSI-640), con el mismo porcentaje de 2 decimales.
- **Valor de la tarjeta:** Σ vendido ÷ Σ meta de las cajas que tienen meta. Con `caja_id`, solo esa caja.
- **Semáforo:** ≥ 100 % **En meta**; ≥ 80 % **Atención**; < 80 % **Fuera de meta**.
- **Detalle:** "Bs 126.850,00 / 138.000,00".
- **Si Gestión de caja no responde:** la tarjeta queda en **Sin datos**, con el motivo en `error`. Los otros 4 KPIs se responden igual.

## KPI-8 · Tasa de ventas canceladas antes del cobro

- **Fórmula:** Ventas canceladas ÷ (Ventas cobradas + Ventas canceladas) × 100, desglosado por motivo.
- **Origen:**
  - Las canceladas salen de `pagos.ventas_canceladas` (TDSI-45), por `creado_en`, caja y cajero.
  - Las cobradas son las mismas ventas APROBADAS del KPI-1.
- **Semáforo:** ≤ 3 % **En meta**; ≤ 6 % **Atención**; > 6 % **Fuera de meta**.
- **Detalle:** "Motivo: El cliente desistió", que es el motivo más frecuente.
- **Desglose:** `por_motivo` con la cantidad, el monto y el porcentaje de cada motivo.

```sql
SELECT motivo, COUNT(*) AS cantidad, SUM(total) AS monto
  FROM pagos.ventas_canceladas
 WHERE creado_en >= ('2026-11-01'::date)::timestamp AT TIME ZONE 'America/La_Paz'
   AND creado_en <  ('2026-11-30'::date + 1)::timestamp AT TIME ZONE 'America/La_Paz'
 GROUP BY motivo ORDER BY cantidad DESC;
-- tasa = canceladas ÷ (transacciones del KPI-1 del mismo periodo + canceladas) × 100
```

## Validación (TDSI-649)

Se validaron las fórmulas con las semillas del repositorio, que traen totales esperados conocidos:
- `sql/seed_historial.sql`: 3 cajeros, una venta anulada, una rechazada y un pago mixto;
- `sql/seed_metodos.sql`: 2 cajeros y 11 ventas, con mixtos, una anulada y una rechazada.

A eso se sumaron 3 ventas canceladas y metas de Bs 100 y Bs 150 en las cajas `DEMO-HIST-CAJA-1` y `DEMO-HIST-CAJA-2`. Se corrió `GET /api/kpis/ventas?desde=2026-11-20&hasta=2026-11-25` y se comparó con las consultas manuales de arriba:

| KPI | Endpoint | Cálculo manual | Coincide |
|---|---|---|---|
| KPI-1 | 22 transacciones · Bs 1.920,80 · **87,31** | `SUM(total) / COUNT(*)` = 1920.80 / 22 = 87.31 | Sí |
| KPI-1 por cajero | hugo Bs 262,00 · ines Bs 150,50 · jorge Bs 393,40 | Totales esperados de `seed_historial.sql` (solo APROBADAS) | Sí |
| KPI-2 | 2 de 24 facturas · Bs 127,00 · 8,3 % | Por cajero: karen 5/1/Bs 100, hugo 5/1/Bs 27, las demás sin anuladas | Sí |
| KPI-5 | Efectivo 30,7 % · Tarjeta 44,2 % · QR 25,1 % (suma 100,0) | `GET /api/pagos/metodos` del mismo periodo: 703,00 / 1.009,80 / 573,00 (30,76 / 44,18 / 25,07) | Sí. Mismos montos; el % se reparte a 1 decimal para sumar 100 |
| KPI-6 | Caja 1: 55 % · Caja 2: 76,93 % · total Bs 170,40 / 250,00 = 68,2 % | `GET /api/metas?fecha=2026-11-25` (pantalla Metas de venta) | Sí |
| KPI-8 | 3 canceladas ÷ (22 + 3) = **12 %** · "Motivo: El cliente desistió" | 2 "El cliente desistió" + 1 "Fondos insuficientes" | Sí |

Filtros: con `caja_id` o `cajero_id` cambian todas las tarjetas (PA TDSI-664). La excepción es KPI-6, que solo filtra por caja y lo avisa en `avisos`.

**Cómo repetirlo en Supabase:**
1. Correr las consultas de cada KPI con el mismo periodo.
2. Compararlas con `GET /api/kpis/ventas`.
3. Para el KPI-6, abrir la pantalla Metas de venta en el día `hasta`.
