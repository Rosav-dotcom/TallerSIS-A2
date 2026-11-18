import './ui.css'

// Tabla del sistema: filas de 48 px, encabezado en etiqueta y hover suave.
// Se arma con <thead>/<tbody> normales; a las celdas de montos se les pone className="ui-num".
function Tabla({ children, etiqueta, ...resto }) {
  return (
    <div className="ui-tabla-contenedor">
      <table className="ui-tabla" aria-label={etiqueta} {...resto}>
        {children}
      </table>
    </div>
  )
}

export default Tabla
