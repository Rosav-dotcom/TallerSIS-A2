import { useState } from 'react'
import { Search } from 'lucide-react'
import {
  Aviso,
  Boton,
  CampoTexto,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Selector,
  Tarjeta,
} from '../../components/ui'
import { FEATURES } from '../../config/features.js'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import CompararCon from './CompararCon.jsx'
import Diferencias from './Diferencias.jsx'
import RegistrarIncidenteModal from './RegistrarIncidenteModal.jsx'
import VistaFactura from './VistaFactura.jsx'
import VistaTransaccion from './VistaTransaccion.jsx'
import { mensajeDeError } from './consultas.js'
import { useBusquedaSoporte } from './useBusquedaSoporte.js'
import './soporte.css'

const BUSQUEDA = {
  factura: { etiqueta: 'Número de factura', ejemplo: 'F-000123', noEncontrada: 'Factura no encontrada' },
  transaccion: { etiqueta: 'ID de transacción', ejemplo: 'VTA-000123', noEncontrada: 'Transacción no encontrada' },
}

// TDSI-204: pantalla "Soporte". Busca una factura o un pago reclamado, los muestra en solo lectura
// y marca lo que no coincide.
function BuscarFacturaOPago() {
  const { administrador } = useAdminAuth()
  const token = administrador?.access_token
  const b = useBusquedaSoporte(token)
  const [registrando, setRegistrando] = useState(false)
  const [registrado, setRegistrado] = useState(null)

  const { resultado } = b
  const campos = new Set(resultado?.comparacion?.diferencias.map((d) => d.campo))
  const textos = BUSQUEDA[b.tipo]

  return (
    <section className="sop-pagina">
      <header className="sop-encabezado">
        <h1>Soporte</h1>
        <p>Busca una factura o un pago reclamado y revisa si sus datos coinciden.</p>
      </header>

      <form
        className="sop-buscador"
        onSubmit={(e) => {
          setRegistrado(null)
          b.enviar(e)
        }}
      >
        <Selector etiqueta="Buscar por" value={b.tipo} onChange={(e) => b.cambiarTipo(e.target.value)}>
          <option value="factura">Factura</option>
          <option value="transaccion">Transacción</option>
        </Selector>
        <CampoTexto
          etiqueta={textos.etiqueta}
          icono={Search}
          placeholder={textos.ejemplo}
          autoComplete="off"
          value={b.valor}
          error={b.errorCampo}
          onChange={(e) => b.cambiarValor(e.target.value)}
        />
        <Boton type="submit" disabled={b.cargando}>
          {b.cargando ? 'Buscando…' : 'Buscar'}
        </Boton>
      </form>

      {registrado && (
        <Aviso tono="exito" titulo="Incidente registrado" onCerrar={() => setRegistrado(null)}>
          {registrado.numero && `Se guardó con el número ${registrado.numero}.`}
        </Aviso>
      )}

      {b.cargando && (
        <div className="sop-columnas">
          <Tarjeta titulo="Factura">
            <EstadoCargando lineas={5} texto="Buscando factura…" />
          </Tarjeta>
          <Tarjeta titulo="Pago">
            <EstadoCargando lineas={5} texto="Buscando pago…" />
          </Tarjeta>
        </div>
      )}

      {!b.cargando && b.error && <EstadoError texto={b.error} onReintentar={b.reintentar} />}

      {!b.cargando && b.noEncontrado && (
        <EstadoVacio
          titulo={BUSQUEDA[b.ultima.tipo].noEncontrada}
          texto={`No hay ningún registro con el número ${b.ultima.valor}. Revisa que esté bien escrito.`}
        />
      )}

      {!b.cargando && !b.error && !b.noEncontrado && !resultado && (
        <EstadoVacio
          titulo="Busca una factura o un pago"
          texto="Ingresa el número de factura o el ID de transacción del reclamo."
        />
      )}

      {!b.cargando && resultado && (
        <>
          {resultado.comparacion && <Diferencias comparacion={resultado.comparacion} />}

          <div className="sop-columnas">
            {resultado.factura ? (
              <VistaFactura factura={resultado.factura} campos={campos} />
            ) : (
              <Tarjeta titulo="Factura">
                <CompararCon
                  etiqueta="Número de factura"
                  ayuda="El pago no indica su factura. Ingrésala para compararlos."
                  error={b.errorVinculo}
                  comparando={b.comparando}
                  onComparar={b.vincular}
                />
              </Tarjeta>
            )}

            {resultado.transaccion ? (
              <VistaTransaccion transaccion={resultado.transaccion} campos={campos} />
            ) : (
              <Tarjeta titulo="Pago">
                {resultado.errorPago ? (
                  <EstadoError
                    titulo="No pudimos cargar el pago"
                    texto={mensajeDeError(resultado.errorPago)}
                    onReintentar={b.reintentar}
                  />
                ) : (
                  <CompararCon
                    etiqueta="ID de transacción"
                    ayuda={
                      resultado.comparacion
                        ? 'Esa transacción no existe. Ingresa otra para compararla con la factura.'
                        : 'La factura no indica su transacción. Ingrésala para compararlas.'
                    }
                    error={b.errorVinculo}
                    comparando={b.comparando}
                    onComparar={b.vincular}
                  />
                )}
              </Tarjeta>
            )}
          </div>

          {FEATURES.soporteIncidentes && (
            <div className="sop-acciones">
              <Boton
                onClick={() => {
                  setRegistrado(null)
                  setRegistrando(true)
                }}
              >
                Registrar incidente
              </Boton>
            </div>
          )}
        </>
      )}

      {registrando && resultado && (
        <RegistrarIncidenteModal
          resultado={resultado}
          token={token}
          onCerrar={() => setRegistrando(false)}
          onRegistrado={(incidente) => {
            setRegistrando(false)
            setRegistrado(incidente)
          }}
        />
      )}
    </section>
  )
}

export default BuscarFacturaOPago
