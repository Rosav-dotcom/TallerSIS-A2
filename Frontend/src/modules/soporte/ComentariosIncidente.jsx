import { Alerta, AreaTexto, Boton, EstadoCargando, EstadoError, Tarjeta } from '../../components/ui'
import { mensajeDeError } from './consultas.js'
import { fecha } from './formato.js'
import { useComentarios } from './useComentarios.js'

// TDSI-969: comentarios del ticket con autor y fecha. No se pueden borrar.
function ComentariosIncidente({ numero, autor }) {
  const c = useComentarios(numero, autor)
  const { datos, cargando, error, recargar } = c.lista
  return (
    <Tarjeta titulo="Comentarios">
      <div className="sop-vista">
        {cargando && !datos && <EstadoCargando texto="Cargando comentarios…" />}
        {error && (
          <EstadoError
            titulo="No pudimos cargar los comentarios"
            texto={mensajeDeError(error)}
            onReintentar={recargar}
          />
        )}
        {!error && datos?.length === 0 && <p className="sop-nota">Todavía no hay comentarios.</p>}
        {!error && datos?.length > 0 && (
          <ul className="sop-comentarios">
            {datos.map((comentario) => (
              <li key={comentario.id} className="sop-comentario">
                <p className="sop-nota">
                  {comentario.autor} · {fecha(comentario.creado_en)}
                </p>
                <p className="sop-texto">{comentario.texto}</p>
              </li>
            ))}
          </ul>
        )}

        {datos && !error && (
          <form className="sop-formulario" onSubmit={c.comentar}>
            <AreaTexto
              etiqueta="Comentario"
              value={c.texto}
              disabled={c.enviando}
              onChange={(e) => c.setTexto(e.target.value)}
            />
            {c.errorEnvio && <Alerta tono="error" titulo={`No se pudo guardar el comentario: ${c.errorEnvio}`} />}
            <div className="sop-acciones">
              <Boton type="submit" variante="contorno" disabled={c.enviando || !c.texto.trim()}>
                {c.enviando ? 'Guardando…' : 'Comentar'}
              </Boton>
            </div>
          </form>
        )}
      </div>
    </Tarjeta>
  )
}

export default ComentariosIncidente
