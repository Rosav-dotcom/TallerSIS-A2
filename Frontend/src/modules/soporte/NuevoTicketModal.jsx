import { Alerta, AreaTexto, Boton, CampoTexto, Modal, Selector } from '../../components/ui'
import { PRIORIDADES, TIPOS } from './catalogos.js'
import { MAX_DESCRIPCION, MAX_REFERENCIA, MAX_USUARIO, useNuevoTicket } from './useNuevoTicket.js'

const ID_FORMULARIO = 'sop-nuevo-ticket'

const REFERENCIA = {
  factura: { etiqueta: 'Número de factura', ejemplo: 'F-000123' },
  transaccion: { etiqueta: 'ID de transacción', ejemplo: 'VTA-000123' },
}

// TDSI-669: formulario "Nuevo ticket" (campos de Figma p.2). Se abre desde la bandeja de Incidentes.
function NuevoTicketModal({ token, onCerrar, onRegistrado }) {
  const f = useNuevoTicket({ token, onRegistrado })
  const { campos, errores } = f
  const referencia = REFERENCIA[campos.referencia_tipo]

  return (
    <Modal
      abierto
      titulo="Nuevo ticket"
      onCerrar={f.enviando ? () => {} : onCerrar}
      acciones={
        <>
          <Boton variante="contorno" onClick={onCerrar} disabled={f.enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form={ID_FORMULARIO} disabled={f.enviando}>
            {f.enviando ? 'Guardando…' : 'Guardar ticket'}
          </Boton>
        </>
      }
    >
      <form id={ID_FORMULARIO} className="sop-formulario" onSubmit={f.guardar} noValidate>
        <p className="sop-nota">El ticket se registra en estado Abierto y recibe su número al guardarlo.</p>
        <CampoTexto
          etiqueta="Usuario afectado"
          placeholder="Correo o nombre del usuario"
          autoComplete="off"
          maxLength={MAX_USUARIO}
          value={campos.usuario_afectado}
          error={errores.usuario_afectado}
          onChange={(e) => f.cambiar('usuario_afectado', e.target.value)}
        />
        <div className="sop-fila-campos">
          <Selector etiqueta="Tipo" value={campos.tipo} onChange={(e) => f.cambiar('tipo', e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.texto}
              </option>
            ))}
          </Selector>
          <Selector
            etiqueta="Prioridad"
            value={campos.prioridad}
            onChange={(e) => f.cambiar('prioridad', e.target.value)}
          >
            {PRIORIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.texto}
              </option>
            ))}
          </Selector>
        </div>
        <div className="sop-fila-campos">
          <Selector
            etiqueta="Referencia"
            ayuda="Opcional"
            value={campos.referencia_tipo}
            onChange={(e) => f.cambiar('referencia_tipo', e.target.value)}
          >
            <option value="">Sin referencia</option>
            <option value="factura">Factura</option>
            <option value="transaccion">Transacción</option>
          </Selector>
          {referencia && (
            <CampoTexto
              etiqueta={referencia.etiqueta}
              placeholder={referencia.ejemplo}
              autoComplete="off"
              maxLength={MAX_REFERENCIA}
              value={campos.referencia}
              error={errores.referencia}
              onChange={(e) => f.cambiar('referencia', e.target.value)}
            />
          )}
        </div>
        <AreaTexto
          etiqueta="Descripción"
          rows={5}
          maxLength={MAX_DESCRIPCION}
          placeholder="¿Qué pasó? Incluye montos, fechas o mensajes de error si los hay."
          value={campos.descripcion}
          error={errores.descripcion}
          onChange={(e) => f.cambiar('descripcion', e.target.value)}
        />
        {f.error && <Alerta tono="error" titulo={`No se pudo guardar el ticket: ${f.error}`} />}
      </form>
    </Modal>
  )
}

export default NuevoTicketModal
