import { Chip, Tabla } from './ui'

const texto = (valor) => (valor === null || valor === undefined || String(valor).trim() === '' ? '—' : valor)


export default function ComparacionModificacion({ actual, nuevo }) {
  const filas = [
    ['Tipo de documento', actual.tipoDocumento, nuevo.tipoDocumento],
    ['NIT/CI', actual.numeroDocumento, nuevo.numeroDocumento],
    ['Razón social', actual.razonSocial, nuevo.razonSocial],
    ['Teléfono', actual.telefono, nuevo.telefono],
  ]
  const normalizar = (v) => String(v ?? '').trim()

  return (
    <div className="fac-form">
      <h3 className="turno-arqueo-titulo">Cambios solicitados</h3>
      <Tabla etiqueta="Cambios solicitados">
        <thead>
          <tr>
            <th>Dato</th>
            <th>Actual</th>
            <th>Nuevo</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(([etiqueta, valorActual, valorNuevo]) => {
            const cambio = normalizar(valorActual) !== normalizar(valorNuevo)
            return (
              <tr key={etiqueta}>
                <th scope="row">{etiqueta}</th>
                <td>{texto(valorActual)}</td>
                <td>
                  {texto(valorNuevo)} {cambio && <Chip tono="info">Modificado</Chip>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </Tabla>
    </div>
  )
}
