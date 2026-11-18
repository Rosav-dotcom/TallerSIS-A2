import './ui.css'

// Pestañas. opciones: [{ valor, texto }]; activa: valor actual; onCambiar(valor).
function Pestanas({ opciones, activa, onCambiar, etiqueta }) {
  return (
    <div className="ui-pestanas" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={o.valor === activa}
          className={['ui-pestana', o.valor === activa && 'ui-pestana--activa'].filter(Boolean).join(' ')}
          onClick={() => onCambiar?.(o.valor)}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

export default Pestanas
