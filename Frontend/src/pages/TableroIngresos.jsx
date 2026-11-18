import { useState } from 'react'
import PanelGeneral from '../components/tablero/PanelGeneral.jsx'
import PanelCajas from '../components/tablero/PanelCajas.jsx'
import PanelMonitoreoCajeros from '../components/tablero/PanelMonitoreoCajeros.jsx'
import PanelRevisionTransacciones from '../components/tablero/PanelRevisionTransacciones.jsx'
import PanelMetodosPago from '../components/tablero/PanelMetodosPago.jsx'
import PanelRecaudado from '../components/tablero/PanelRecaudado.jsx'
import PanelComparacion from '../components/tablero/PanelComparacion.jsx'
import PanelReportes from '../components/tablero/PanelReportes.jsx'
import { Pestanas } from '../components/ui'
import './turno.css'
import './tablero.css'

const PESTANAS = [
  { id: 'general', etiqueta: 'General' },
  { id: 'cajas', etiqueta: 'Cajas' },
  { id: 'cajeros', etiqueta: 'Cajeros' },
  { id: 'metodos', etiqueta: 'Métodos de pago' },
  { id: 'recaudado', etiqueta: 'Recaudado' },
  { id: 'comparacion', etiqueta: 'Comparación' },
  { id: 'reportes', etiqueta: 'Reportes' },
]

// Todos los dashboards de supervisión viven aca, cada uno en su pestaña, para no
// repartirlos en un monton de paginas sueltas en el navbar. Cada pestaña solo
// monta (y pide datos) cuando esta activa.
function TableroIngresos() {
  const [pestana, setPestana] = useState('general')

  return (
    <section className="tab-pagina">
      <div className="turno-encabezado">
        <h1>Tablero de ingresos</h1>
      </div>

      <Pestanas
        etiqueta="Secciones del tablero"
        opciones={PESTANAS.map((p) => ({ valor: p.id, texto: p.etiqueta }))}
        activa={pestana}
        onCambiar={setPestana}
      />

      <div className="tab-contenido">
        {pestana === 'general' && <PanelGeneral />}
        {pestana === 'cajas' && <PanelCajas />}
        {pestana === 'cajeros' && (
          <>
            <PanelMonitoreoCajeros />
            <PanelRevisionTransacciones />
          </>
        )}
        {pestana === 'metodos' && <PanelMetodosPago />}
        {pestana === 'recaudado' && <PanelRecaudado />}
        {pestana === 'comparacion' && <PanelComparacion />}
        {pestana === 'reportes' && <PanelReportes />}
      </div>
    </section>
  )
}

export default TableroIngresos
