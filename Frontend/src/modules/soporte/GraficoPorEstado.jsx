import GraficoBarras from '../../components/GraficoBarras.jsx'
import { Tarjeta } from '../../components/ui'
import { SERIE_GRAFICO } from '../../styles/colores.js'

const NUMERO = new Intl.NumberFormat('es-BO')

// TDSI-1075: incidentes por estado del rango (Figma p.5, barras). Cada estado conserva su color
// aunque cambien las fechas, y cada barra lleva su nombre y su cantidad (no depende solo del color).
function GraficoPorEstado({ porEstado, total }) {
  const items = porEstado.map((e, i) => ({
    etiqueta: e.estado,
    valor: e.cantidad,
    color: SERIE_GRAFICO[i % SERIE_GRAFICO.length],
  }))
  return (
    <Tarjeta titulo="Incidentes por estado">
      <GraficoBarras
        items={items}
        formatoValor={(v) => `${NUMERO.format(v)}${total ? ` · ${Math.round((v / total) * 100)} %` : ''}`}
      />
    </Tarjeta>
  )
}

export default GraficoPorEstado
