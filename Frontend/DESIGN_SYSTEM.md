# Sistema de diseño RePay

Guía única de estilo del frontend. Todo lo que se migra o se construye (Sprint 3 rediseñado y pantallas nuevas del Sprint 4) sigue este documento.

- **Fuente de verdad visual:** el archivo de Figma (página "01 · Fundamentos" y las páginas de cada pantalla).
- **Fuente de verdad en código:** `src/index.css`. Si un valor cambia, se cambia en los dos lugares.

---

## 1. Reglas de la migración

1. **Solo cambia la interfaz visual.** No se tocan la lógica, los estados (`useState`), los hooks, las llamadas a la API (`src/api/`), los contextos (`src/context/`), las utilidades (`src/utils/`) ni las fórmulas de negocio (vuelto, arqueo, totales, IVA).
2. **Se mantiene la estructura funcional.** Los `onClick`, `onChange`, condiciones y props siguen iguales; solo cambian clases, estilos y la forma de los elementos.
3. **Solo valores de este documento.** Nada de colores escritos a mano (`#c0392b`), ni medidas inventadas. Siempre `var(--…)`.
4. **Sin estética genérica de IA:** sin degradados, sin sombras fuertes, sin brillos, sin animaciones de adorno, sin íconos o emojis de relleno. Fondos planos, bordes finos y la sombra suave del sistema.
5. **Los textos de las PA se copian exactos** (por ejemplo "Comprobante no encontrado o anulado", "PIN inválido").
6. **Cada pantalla tiene sus estados:** cargando, vacío, error (con "Reintentar") y éxito.

## 2. Colores

| Variable | Valor | Uso |
|---|---|---|
| `--navy` | `#14213D` | Primario: botones principales, barra lateral, títulos |
| `--navy-hover` | `#1E2F55` | Hover del primario |
| `--olive` | `#5C6236` | Secundario |
| `--olive-dark` | `#474C29` | Secundario presionado |
| `--bone` | `#EFE8D8` | Fondo general de la aplicación |
| `--surface` | `#FAF7F0` | Tarjetas, tablas, modales |
| `--border` | `#D9CFBA` | Bordes y separadores |
| `--text` | `#1C2230` | Texto principal |
| `--muted` | `#5A6072` | Texto secundario, ayudas |
| `--gold` | `#B08D4F` | Decorativo, **solo sobre navy** (logo, línea de sección activa) |
| `--gold-dark` | `#8A6A35` | Texto dorado sobre fondos claros |
| `--success` | `#2E7D4F` | Éxito (Pagado, Confirmado, Cuadra) |
| `--warning` | `#96590A` | Advertencia (Pendiente, Faltante) |
| `--error` | `#B42318` | Error y acciones peligrosas (Anular, Rechazado) |
| `--info` | `#2F6DB5` | Información y foco visible |
| `--success-bg` `--warning-bg` `--error-bg` `--info-bg` | color de estado al 10 % | Fondo de chips y alertas |

Reglas:
- **El dorado no comunica estados.** Para estados se usan success, warning, error e info.
- **Un estado siempre lleva texto**, nunca solo color (por ejemplo, chip "Pagado" verde, no un punto verde).
- Contraste mínimo AA en todo texto.
- **Blanco translúcido** (`rgba(255, 255, 255, …)`) solo sobre fondos navy (menú, login), para separadores y estados hover.

### Colores en JavaScript

Los atributos SVG (`fill`, `stroke`) no aceptan `var(--…)`. Para gráficos se usa `src/styles/colores.js`:

```js
import { COLOR, SERIE_GRAFICO } from '../styles/colores.js'
<polyline stroke={COLOR.navy} />
```

- `SERIE_GRAFICO`: navy, olive, gold y sus tonos, en ese orden.
- En estilos normales (`style={{ … }}` o CSS) siempre `var(--…)`, nunca `COLOR`.
- Si un color cambia en `index.css`, se cambia también en `colores.js`.

## 3. Tipografía

| Variable | Valor | Uso |
|---|---|---|
| `--texto-titulo-1` | Cormorant Garamond SemiBold 32/40 | Título de pantalla |
| `--texto-titulo-2` | Cormorant Garamond SemiBold 24/32 | Título de sección o tarjeta grande |
| `--texto-titulo-3` | Cormorant Garamond SemiBold 20/28 | Título de tarjeta o modal |
| `--texto-subtitulo` | Inter Medium 16/24 | Subtítulos, encabezados de bloque |
| `--texto-cuerpo` | Inter Regular 14/24 | Texto general (es el del `body`) |
| `--texto-etiqueta` | Inter Medium 12/16 | Etiquetas, encabezados de tabla, en MAYÚSCULAS cuando corresponde |

Uso: `font: var(--texto-titulo-2);`

- `h1`, `h2` y `h3` usan la serif por defecto; todo lo demás usa Inter.
- **Montos:** Inter con cifras tabulares (activadas en todo el `body`), formato `Bs 1.250,50` (coma decimal, punto de miles). La migración no cambia cómo se formatean los montos; solo su estilo.
- Las fuentes vienen incluidas en el proyecto (`@fontsource/inter` y `@fontsource/cormorant-garamond`), no se cargan de internet.

## 4. Medidas

| Variable | Valor | Uso |
|---|---|---|
| `--espacio-1` … `--espacio-7` | 4, 8, 12, 16, 24, 32, 48 px | Márgenes y separaciones (grilla de 8 px) |
| `--radio-tarjeta` | 10 px | Tarjetas, modales, paneles |
| `--radio-control` | 8 px | Botones, campos, chips |
| `--alto-tactil` | 44 px | Alto mínimo de botones y campos |
| `--alto-fila` | 48 px | Alto de fila de tabla |
| `--sombra` | navy al 8 % | Única sombra permitida (tarjetas y modales) |
| `--overlay` | navy al 50 % | Velo detrás de los modales |

- **Íconos:** lineales de 1,5 px, estilo Lucide.
- **Foco visible:** contorno `--info` de 2 px en todo elemento enfocado con teclado.
- **Pantallas base:** escritorio 1440×900 (oficina) y 1366×768 (caja).

## 5. Variables anteriores

Hasta terminar la migración se mantienen las variables antiguas, apuntando a las nuevas, para que nada se rompa:

| Variable anterior | Ahora apunta a |
|---|---|
| `--color-brand-dark` | `--navy` |
| `--color-brand-olive` | `--olive` |
| `--color-brand-mint` | `--border` |
| `--color-brand-green` | `--success-bg` |

**No usarlas en código nuevo.** Se eliminan en la última fase de la migración.

## 6. Componentes y pantallas

- Componentes base (`src/components/ui/`): se documentan en `docs/COMPONENTES.md` (patch 0003).
- Guías por pantalla: `docs/pantallas/` (índice en `docs/pantallas/README.md`). Las del Sprint 4 están en `docs/pantallas/sprint4/`; cada una dice su página de Figma, dónde va cada bloque, qué componentes usa, sus subtareas de Jira, sus PA y el backend que necesita.

## 7. Revisión antes de cada Pull Request

- [ ] `npm run lint` sin errores y `npm run build` correcto.
- [ ] Captura de Figma y captura real lado a lado en el PR.
- [ ] Ningún color o medida fuera de este documento.
- [ ] Sin cambios en `api/`, `context/`, `hooks/`, `utils/` ni en la lógica de la pantalla.
- [ ] Flujo probado en el navegador con el backend levantado.
