# Contrato · Aviso de devoluciones a Inventario

TDSI-77 (historia TDSI-77). Para el **Módulo de Gestión de Inventarios y Almacén**: qué mensaje publica Devoluciones (Grupo A) cuando procesa una devolución, y qué acuse esperamos de vuelta.

Mismo patrón que ya usamos con Contabilidad (TDSI-22/52) y Compras (TDSI-54): Google Pub/Sub, mensajes JSON, acuse por el tópico del Grupo A.

| | |
|---|---|
| **Quién publica** | `devoluciones_reembolsos` (Grupo A), al **procesar** una devolución |
| **Dónde** | El tópico de Inventario (`INVENTARIO_PUBSUB_TOPIC`) |
| **Acuse** | Inventario publica en el tópico del Grupo A; lo leemos de la suscripción `ucb-sis323-sub-a-sub` (`INVENTARIO_ACUSES_SUBSCRIPTION`) |

## 1. Mensaje `devolucion_stock` (Devoluciones → Inventario)

```json
{
  "sistema_origen": "DEVOLUCIONES",
  "tipo_mensaje": "devolucion_stock",
  "referencia_externa": "DEV-000123",
  "mensaje_id": "DEV-000123-1",
  "fecha_documento": "2026-11-24",
  "datos": {
    "factura_numero": "F-000456",
    "tipo": "PARCIAL",
    "items": [
      { "codigo_producto": "ACE-900", "descripcion": "Aceite 900ml", "cantidad": 2, "condicion": "REINGRESO" },
      { "codigo_producto": null, "descripcion": "Arroz 1kg", "cantidad": 1, "condicion": "MERMA" }
    ]
  }
}
```

| Campo | Significado |
|---|---|
| `referencia_externa` | Código de la devolución, `DEV-NNNNNN` |
| `mensaje_id` | Clave de idempotencia: `DEV-NNNNNN-<versión>`. Los reintentos automáticos repiten el **mismo** `mensaje_id`, así que si llega dos veces, Inventario lo procesa una sola vez. Un "Reenviar" manual sube la versión (`-2`, `-3`…). |
| `condicion` | `REINGRESO`: el producto vuelve al stock. `MERMA`: se da de baja. |
| `codigo_producto` | Código del producto si la venta lo tenía; puede venir `null` (las facturas de caja no guardan código de producto), y entonces se identifica por `descripcion`. |

Atributos del mensaje: `tipo=DEVOLUCION_STOCK`, `referencia_externa`, `idempotency_key` (= `mensaje_id`), `origen=devoluciones`, `grupo=A`.

## 2. Acuse (Inventario → Devoluciones)

Inventario publica en el tópico del Grupo A:

```json
{
  "sistema_origen": "INVENTARIO",
  "tipo_mensaje": "acuse_devolucion_stock",
  "referencia_externa": "DEV-000123",
  "mensaje_id": "DEV-000123-1",
  "estado": "confirmado",
  "motivo": null
}
```

| Campo | Regla |
|---|---|
| `estado` | `confirmado` (stock actualizado) o `rechazado` |
| `motivo` | Obligatorio si es `rechazado` (se muestra en la pantalla junto al botón "Reenviar") |
| `mensaje_id` | Recomendado: el del mensaje que se acusa. Un acuse de una versión anterior (antes de un "Reenviar") se ignora. |

## 3. Estados que ve la pantalla (columna "Inventario")

`Pendiente` → `Enviado` → `Confirmado` / `Rechazado`, o `Error` si Pub/Sub falló 5 veces seguidas. Con `Rechazado` o `Error` aparece "Reenviar".
