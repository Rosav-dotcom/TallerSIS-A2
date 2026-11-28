// Datos en solo lectura: [{ etiqueta, valor, difiere }]. La diferencia se marca con texto, no solo con color.
function DatosOperacion({ datos }) {
  return (
    <dl className="sop-datos">
      {datos.map(({ etiqueta, valor, difiere }) => (
        <div key={etiqueta} className={difiere ? 'sop-dato sop-dato--difiere' : 'sop-dato'}>
          <dt>{etiqueta}</dt>
          <dd>
            {valor}
            {difiere && <span className="sop-marca">No coincide</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default DatosOperacion
