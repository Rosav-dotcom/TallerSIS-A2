// Ícono lineal de 1,5 px (estilo Lucide), del tamaño indicado. Decorativo por defecto.
function Icono({ icono: Componente, tamano = 20, titulo }) {
  return (
    <Componente
      size={tamano}
      strokeWidth={1.5}
      aria-hidden={titulo ? undefined : true}
      aria-label={titulo}
      role={titulo ? 'img' : undefined}
    />
  )
}

export default Icono
