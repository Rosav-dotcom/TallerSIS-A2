# Componentes base (`src/components/ui/`)

Piezas reutilizables del sistema de diseño RePay. Se usan en las pantallas nuevas del Sprint 4 y al migrar las pantallas existentes.

- **Diseño:** Figma, páginas "02 · Botones y campos", "03 · Estados y datos" y "04 · Patrones".
- **Reglas generales:** `DESIGN_SYSTEM.md`.
- **Estilos:** `src/components/ui/ui.css`, con clases que empiezan con `ui-`. Solo usan variables de `src/index.css`.
- **Íconos:** `lucide-react`, siempre a través de `<Icono>` (línea de 1,5 px).

```jsx
import { Boton, CampoTexto, Chip, Modal } from '../components/ui'
```

## Reglas de uso

1. **Los componentes no llaman a la API ni guardan datos de negocio.** Reciben valores y avisan cambios (`value`, `onChange`, `onClick`). La lógica sigue en la pantalla, sus hooks y `src/api/`.
2. **Al migrar una pantalla, se cambia el elemento visual y se conservan sus props funcionales.** Por ejemplo, `<button className="btn-primario" onClick={cobrar} disabled={!valido}>` pasa a `<Boton onClick={cobrar} disabled={!valido}>`.
3. **Los textos de las PA se escriben exactos**, también en `error`, `titulo` y `texto` de estos componentes.
4. **No agregar estilos propios a un componente base.** Si falta una variante, se agrega en `ui.css` y se documenta aquí.
5. **Dueño de la carpeta:** una sola persona (sugerido: Sebastián Orias). Los cambios a `ui/` van en un Pull Request aparte.

---

## Acciones

### `Boton`
| Prop | Valores | Notas |
|---|---|---|
| `variante` | `primario` (por defecto), `secundario`, `contorno`, `fantasma`, `peligro` | `peligro` solo para acciones destructivas (Anular, Rechazar) |
| `icono` | un ícono de `lucide-react` | Opcional, va a la izquierda |
| `ancho` | `true` / `false` | Ocupa todo el ancho |
| `type`, `onClick`, `disabled`… | | Se pasan al `<button>` tal cual |

```jsx
<Boton onClick={confirmarCobro} disabled={!puedeCobrar}>Confirmar cobro</Boton>
<Boton variante="contorno" onClick={cancelar}>Cancelar venta</Boton>
<Boton variante="peligro" onClick={anular}>Anular pago</Boton>
```

### `BotonOpcion`
Opción grande seleccionable, de 72 px de alto: métodos de pago, motivos, formas de reembolso.
```jsx
import { Banknote } from 'lucide-react'
<BotonOpcion icono={Banknote} activa={metodo === 'EFECTIVO'} onClick={() => setMetodo('EFECTIVO')}>Efectivo</BotonOpcion>
```
Íconos sugeridos: Efectivo `Banknote`, QR `QrCode`, Tarjeta `CreditCard`, Transferencia `ArrowLeftRight`.

## Campos

Todos llevan una **etiqueta persistente** arriba y miden 44 px de alto. `error` pinta el borde rojo y muestra el mensaje; `ayuda` muestra un texto gris. Las demás props (`value`, `onChange`, `name`, `placeholder`, `disabled`…) van al control nativo.

| Componente | Uso | Props propias |
|---|---|---|
| `CampoTexto` | Texto, números, fechas | `etiqueta`, `ayuda`, `error`, `prefijo` (ej. `"Bs"`), `icono` (izquierda), `accion` (nodo a la derecha) |
| `CampoContrasena` | Contraseña con botón de mostrar u ocultar | Las mismas de `CampoTexto` |
| `Selector` | Lista desplegable | `etiqueta`, `ayuda`, `error`; las `<option>` van como hijos |
| `AreaTexto` | Observaciones | `maxLength` muestra el contador `0/300` |
| `CampoPin` | PIN de autorización del supervisor | `value` (texto con los dígitos), `onChange(nuevoValor)`, `longitud` (4) |
| `Casilla` | Casilla de verificación | `checked`, `onChange`; el texto va como hijo |

```jsx
<CampoTexto etiqueta="Monto recibido" prefijo="Bs" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)}
  error={monto && Number(monto) <= 0 ? 'El monto debe ser mayor que Bs 0,00' : undefined} />

<CampoTexto etiqueta="Buscar comprobante" icono={Search} placeholder="Código de barras, N.º de factura o NIT/CI"
  value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} />

<CampoPin value={pin} onChange={setPin} error={errorPin ? 'PIN inválido' : undefined} />
```
El buscador funciona con el **lector de código de barras**: el lector escribe como un teclado y termina con Enter, así que basta con escuchar `onKeyDown`.

## Estados y datos

### `Chip`
El texto identifica el estado y el color lo refuerza. El tono se elige solo para estos estados:

| Tono | Estados |
|---|---|
| Éxito (verde) | Confirmado, Pagado, Cuadra, Resuelto |
| Advertencia (ámbar) | Pendiente, Faltante, Sobrante, Escalado |
| Error (rojo) | Rechazado, Error |
| Info (azul) | Enviado, Revertido, Total |
| Neutro (gris) | Anulado, Expirado, Parcial |

```jsx
<Chip>{factura.estado}</Chip>        // "Pagado" → verde
<Chip tono="info">En revisión</Chip> // estado fuera de la lista: se indica el tono
```

### `ChipPrioridad`
`Baja`, `Media`, `Alta` o `Crítica`, cada una con su ícono. Crítica lleva borde rojo.

### `Tarjeta` y `TarjetaKpi`
```jsx
<Tarjeta titulo="Envíos a Contabilidad" acciones={<Boton variante="contorno">Actualizar</Boton>}>…</Tarjeta>

<TarjetaKpi titulo="Ticket promedio" valor="Bs 85,40" variacion={8.4} detalleVariacion="vs. mes anterior"
  formula="Ticket promedio = total vendido ÷ número de ventas" />
```
`valor` llega **ya formateado**; el componente no calcula nada. `variacion` es un número en %: positivo pinta verde ▲ y negativo rojo ▼.

### `Tabla`
Filas de 48 px, encabezado en etiqueta y hover suave. Se arma con `<thead>` y `<tbody>` normales. A las celdas de montos se les pone `className="ui-num"`, que las alinea a la derecha con cifras tabulares.
```jsx
<Tabla etiqueta="Operaciones recientes">
  <thead><tr><th>Documento</th><th className="ui-num">Importe</th><th>Estado</th></tr></thead>
  <tbody>{filas.map((f) => <tr key={f.id}><td>{f.numero}</td><td className="ui-num">{formatoBs(f.total)}</td><td><Chip>{f.estado}</Chip></td></tr>)}</tbody>
</Tabla>
```

### `Pestanas`
```jsx
<Pestanas etiqueta="Tablero" activa={panel} onCambiar={setPanel}
  opciones={[{ valor: 'general', texto: 'General' }, { valor: 'cajas', texto: 'Cajas' }]} />
```

## Patrones

### `Alerta` (en línea) y `Aviso` (notificación)
Tonos: `exito`, `advertencia`, `error`, `info`. `Aviso` admite `onCerrar`.
```jsx
<Alerta tono="advertencia" titulo="Fuera de plazo">La compra superó los 7 días hábiles.</Alerta>
<Aviso tono="exito" titulo="Pago confirmado" onCerrar={cerrarAviso}>El comprobante está listo.</Aviso>
```

### `Modal`
Escape cierra, el foco entra al abrir y vuelve al elemento anterior al cerrar. No se cierra al hacer clic fuera, salvo que se indique `cerrarAlClicFuera`; así se evita perder un cobro por un clic accidental.
```jsx
<Modal abierto={confirmando} titulo="¿Anular este pago?" onCerrar={() => setConfirmando(false)}
  acciones={<><Boton variante="contorno" onClick={() => setConfirmando(false)}>Cancelar</Boton>
              <Boton variante="peligro" onClick={anular}>Sí, anular pago</Boton></>}>
  <p>Esta acción queda registrada en la auditoría.</p>
</Modal>
```

- `ancho`: hasta 760 px, para tablas o resúmenes.
- `rol="alertdialog"`: para avisos que piden una decisión antes de seguir (por ejemplo, "Posible cobro repetido"). Por defecto es `dialog`.

### `Pasos`
```jsx
<Pasos pasos={['Comprobante', 'Ítems', 'Motivo', 'Reembolso']} actual={paso} />
```

### `LineaTiempo`
```jsx
<LineaTiempo eventos={historial.map((h) => ({ id: h.id, titulo: `${h.hora} · ${h.estado}`, detalle: h.usuario, hecho: h.final }))} />
```

### Estados de pantalla
Cada pantalla que carga datos muestra uno de estos tres estados:
```jsx
{cargando && <EstadoCargando />}
{error && <EstadoError texto={error} onReintentar={cargar} />}
{!cargando && !error && filas.length === 0 && <EstadoVacio titulo="No hay devoluciones" texto="Las devoluciones registradas aparecerán aquí." />}
```

### `Icono`
```jsx
import { Search } from 'lucide-react'
<Icono icono={Search} />                        // decorativo, 20 px
<Icono icono={Search} titulo="Buscar" tamano={24} /> // con significado propio
```
