import { ArrowLeft, Search } from 'lucide-react'
import {
  Boton,
  CampoTexto,
  Chip,
  ChipPrioridad,
  EstadoCargando,
  EstadoError,
  EstadoVacio,
  Tabla,
  Tarjeta,
} from '../../components/ui'
import { useAdminAuth } from '../../context/AdminAuthContext.jsx'
import { PRIORIDADES, TIPOS, TONO_ESTADO } from './catalogos.js'
import { mensajeDeError } from './consultas.js'
import { fecha, texto } from './formato.js'
import { useHistorialUsuario } from './useHistorialUsuario.js'
import './soporte.css'
import './incidentes.css'

const TEXTO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto]))
const TEXTO_PRIORIDAD = Object.fromEntries(PRIORIDADES.map((p) => [p.valor, p.texto]))
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// Paso 1: elegir a quién ver. Sin texto se listan los usuarios con incidentes más recientes.
function ElegirUsuario({ h }) {
  const { datos: usuarios, cargando, error, recargar } = h.usuarios
  return (
    <>
      <form className="sop-buscador sop-buscador-usuario" role="search" onSubmit={(e) => e.preventDefault()}>
        <CampoTexto
          etiqueta="Usuario"
          icono={Search}
          placeholder="Correo o nombre del usuario afectado"
          autoComplete="off"
          value={h.busqueda}
          onChange={(e) => h.setBusqueda(e.target.value)}
        />
      </form>

      {cargando && !usuarios && <EstadoCargando lineas={4} texto="Buscando usuarios…" />}
      {!cargando && error && <EstadoError texto={mensajeDeError(error)} onReintentar={recargar} />}
      {!cargando && !error && usuarios?.length === 0 && (
        <EstadoVacio
          titulo={h.busqueda.trim() ? 'No hay usuarios con ese nombre' : 'Todavía no hay incidentes'}
          texto={
            h.busqueda.trim()
              ? 'Revisa el correo o el nombre; solo aparecen usuarios que tienen incidentes.'
              : 'Los usuarios con incidentes aparecerán aquí.'
          }
        />
      )}
      {!error && usuarios?.length > 0 && (
        <Tabla etiqueta="Usuarios con incidentes" aria-busy={cargando}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th className="ui-num">Incidentes</th>
              <th>Último incidente</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.usuario}>
                <td className="sop-usuario">{u.usuario}</td>
                <td className="ui-num">{u.cantidad}</td>
                <td>{fecha(u.ultimo_en)}</td>
                <td>
                  <Boton variante="fantasma" onClick={() => h.elegir(u.usuario)}>
                    Ver historial
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
    </>
  )
}

// Paso 2: incidentes del usuario, del más reciente al más antiguo, con fecha, estado y solución.
function HistorialDe({ h }) {
  const { datos, cargando, error, recargar } = h.historial
  const resumen = datos?.resumen
  const incidentes = datos?.incidentes ?? []

  return (
    <>
      <Tarjeta
        titulo={h.usuario}
        acciones={
          <Boton variante="contorno" icono={ArrowLeft} onClick={h.cambiarUsuario}>
            Cambiar usuario
          </Boton>
        }
      >
        {resumen ? (
          <p className="sop-resumen">
            {plural(resumen.total, 'incidente', 'incidentes')} · {plural(resumen.abiertos, 'abierto', 'abiertos')} ·{' '}
            {plural(resumen.resueltos, 'resuelto o cerrado', 'resueltos o cerrados')}
          </p>
        ) : (
          !error && <p className="sop-nota">Cargando resumen…</p>
        )}
      </Tarjeta>

      {cargando && !datos && <EstadoCargando lineas={5} texto="Cargando historial…" />}
      {!cargando && error && <EstadoError texto={mensajeDeError(error)} onReintentar={recargar} />}
      {!cargando && !error && datos && incidentes.length === 0 && (
        <EstadoVacio
          titulo="Este usuario no tiene incidentes"
          texto="Revisa que el correo o el nombre estén escritos igual que en los tickets."
        />
      )}
      {!error && incidentes.length > 0 && (
        <>
          <Tabla etiqueta={`Historial de incidentes de ${h.usuario}`}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Número</th>
                <th>Tipo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Solución</th>
              </tr>
            </thead>
            <tbody>
              {incidentes.map((i) => (
                <tr key={i.numero}>
                  <td className="sop-fecha">{fecha(i.fecha)}</td>
                  <td className="sop-numero">{i.numero}</td>
                  <td>{TEXTO_TIPO[i.tipo] ?? texto(i.tipo)}</td>
                  <td>
                    <ChipPrioridad>{TEXTO_PRIORIDAD[i.prioridad] ?? i.prioridad}</ChipPrioridad>
                  </td>
                  <td>
                    <Chip tono={TONO_ESTADO[i.estado]}>{i.estado}</Chip>
                  </td>
                  <td className="sop-solucion">
                    {i.solucion ? i.solucion : <span className="sop-nota">Sin solución registrada</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
          {resumen && resumen.mostrados < resumen.total && (
            <p className="sop-nota">
              Se muestran los {resumen.mostrados} incidentes más recientes de {resumen.total}.
            </p>
          )}
        </>
      )}
    </>
  )
}

// TDSI-210: "Historial por usuario" (/soporte/historial). Figma p.8 (menú), p.2 (buscador) y p.3 (tabla y chips).
function HistorialUsuario() {
  const { administrador } = useAdminAuth()
  const h = useHistorialUsuario(administrador?.access_token)

  return (
    <section className="sop-pagina">
      <header className="sop-bandeja-encabezado">
        <div className="sop-encabezado">
          <h1>Historial por usuario</h1>
          <p>Incidentes de un usuario con su fecha, estado y la solución aplicada, del más reciente al más antiguo.</p>
        </div>
      </header>
      {h.usuario ? <HistorialDe key={h.usuario} h={h} /> : <ElegirUsuario h={h} />}
    </section>
  )
}

export default HistorialUsuario
