import { Alerta, AreaTexto, Boton, Modal, Selector } from '../../components/ui'
import { PRIORIDADES, TIPOS, useRegistrarIncidente } from './useRegistrarIncidente.js'

const ID_FORMULARIO = 'sop-incidente'

// Guarda el hallazgo como incidente, con la referencia a la factura o al pago que se está revisando.
function RegistrarIncidenteModal({ resultado, registradoPor, onCerrar, onRegistrado }) {
  const f = useRegistrarIncidente({ resultado, registradoPor, onRegistrado })
  return (
    <Modal
      abierto
      titulo="Registrar incidente"
      onCerrar={onCerrar}
      acciones={
        <>
          <Boton variante="contorno" onClick={onCerrar} disabled={f.enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={ID_FORMULARIO} disabled={f.enviando}>
            {f.enviando ? 'Guardando…' : 'Guardar incidente'}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="sop-formulario" onSubmit={f.guardar}>
        <p className="sop-nota">
          Referencia: {f.referencia.referencia_tipo === 'factura' ? 'factura' : 'pago'} {f.referencia.referencia}
        </p>
        <Selector etiqueta="Tipo" value={f.tipo} onChange={(e) => f.setTipo(e.target.value)}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.texto}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Prioridad" value={f.prioridad} onChange={(e) => f.setPrioridad(e.target.value)}>
          {PRIORIDADES.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.texto}
            </option>
          ))}
        </Selector>
        <AreaTexto
          etiqueta="Descripción"
          rows={6}
          value={f.descripcion}
          error={f.errorDescripcion}
          onChange={(e) => f.cambiarDescripcion(e.target.value)}
        />
        {f.error && <Alerta tono="error" titulo={`No se pudo guardar el incidente: ${f.error}`} />}
      </form>
    </Modal>
  )
}

export default RegistrarIncidenteModal
