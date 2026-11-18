// Título de Pagos, ventas canceladas hoy y botón "Mis respuestas rápidas".
function EncabezadoPagos({ canceladasHoy, onAbrirRespuestas }) {
  return (
    <div className="pagos-encabezado">
      <h1>Método de pago</h1>
      {canceladasHoy !== null && <span className="canceladas-hoy">Canceladas hoy: {canceladasHoy}</span>}
      <button type="button" className="btn btn-secundario" onClick={onAbrirRespuestas}>
        Mis respuestas rápidas
      </button>
    </div>
  )
}

export default EncabezadoPagos
