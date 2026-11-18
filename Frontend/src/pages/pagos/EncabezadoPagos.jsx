import { Boton } from '../../components/ui'

// Título de Pagos, ventas canceladas hoy y botón "Mis respuestas rápidas".
function EncabezadoPagos({ canceladasHoy, onAbrirRespuestas }) {
  return (
    <div className="cob-cabecera">
      <div className="turno-encabezado">
        <h1>Cobrar</h1>
        {canceladasHoy !== null && <p>Canceladas hoy: {canceladasHoy}</p>}
      </div>
      <Boton variante="contorno" onClick={onAbrirRespuestas}>
        Mis respuestas rápidas
      </Boton>
    </div>
  )
}

export default EncabezadoPagos
