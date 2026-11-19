import { useEffect, useState } from 'react'
import { obtenerComparativoMensual } from '../api/tablero.js'
import { Alerta, CampoTexto, Selector, Tabla, TarjetaKpi } from '../components/ui'
import './turno.css'
import './admin.css'

const MESES = [
  { valor: 1, etiqueta: 'Enero' }, { valor: 2, etiqueta: 'Febrero' }, { valor: 3, etiqueta: 'Marzo' },
  { valor: 4, etiqueta: 'Abril' }, { valor: 5, etiqueta: 'Mayo' }, { valor: 6, etiqueta: 'Junio' },
  { valor: 7, etiqueta: 'Julio' }, { valor: 8, etiqueta: 'Agosto' }, { valor: 9, etiqueta: 'Septiembre' },
  { valor: 10, etiqueta: 'Octubre' }, { valor: 11, etiqueta: 'Noviembre' }, { valor: 12, etiqueta: 'Diciembre' },
]
const NOMBRE_MES = Object.fromEntries(MESES.map((m) => [m.valor, m.etiqueta]))

const hoy = new Date()
const bs = (v) => Number(v ?? 0).toFixed(2)

function Variacion({ valor }) {
  if (valor === null || valor === undefined) {
    return <span className="adm-detalle">Sin datos del mes anterior</span>
  }
  const clase = valor > 0 ? 'adm-variacion--sube' : valor < 0 ? 'adm-variacion--baja' : 'adm-variacion--igual'
  const signo = valor > 0 ? '+' : ''
  return (
    <strong className={clase}>
      {signo}
      {valor.toFixed(2)}%
    </strong>
  )
}

// TDSI-190/738-741: pantalla "Comparativo mensual" del Administrador -- total del mes
// elegido vs. el mes anterior, por caja y por metodo de pago, con la variacion en %.
function ComparativoMensual() {
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerComparativoMensual(mes, anio)
      .then((r) => vigente && setDatos(r.data))
      .catch((err) => vigente && setError(err.mensaje || err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [mes, anio])

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Comparativo mensual</h1>
        <p>Total vendido del mes elegido contra el mes anterior, por caja y por método de pago.</p>
      </div>

      <div className="adm-filtros">
        <Selector etiqueta="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </Selector>
        <CampoTexto
          etiqueta="Año"
          type="number"
          min="2000"
          max="2100"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
        />
      </div>

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && datos && (
        <>
          {datos.comparadoPorMismosDias && (
            <Alerta
              tono="info"
              titulo={`Como es el mes en curso, se compara contra los mismos días de ${NOMBRE_MES[datos.mesAnterior]}.`}
            />
          )}

          <div className="adm-kpis">
            <TarjetaKpi titulo={`${NOMBRE_MES[datos.mes]} ${datos.anio}`} valor={`Bs. ${bs(datos.total.actual)}`} />
            <TarjetaKpi
              titulo={`${NOMBRE_MES[datos.mesAnterior]} ${datos.anioAnterior}`}
              valor={`Bs. ${bs(datos.total.anterior)}`}
            />
            <TarjetaKpi titulo="Variación" valor={<Variacion valor={datos.total.variacion} />} />
          </div>

          <h2 className="adm-subtitulo">Por caja</h2>
          <Tabla etiqueta="Comparativo por caja">
            <thead>
              <tr>
                <th>Caja</th>
                <th className="ui-num">{NOMBRE_MES[datos.mes]} (Bs.)</th>
                <th className="ui-num">{NOMBRE_MES[datos.mesAnterior]} (Bs.)</th>
                <th className="ui-num">Variación</th>
              </tr>
            </thead>
            <tbody>
              {datos.porCaja.map((c) => (
                <tr key={c.caja_id}>
                  <td>{c.caja_id}</td>
                  <td className="ui-num">{bs(c.actual)}</td>
                  <td className="ui-num">{bs(c.anterior)}</td>
                  <td className="ui-num">
                    <Variacion valor={c.variacion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>

          <h2 className="adm-subtitulo">Por método de pago</h2>
          <Tabla etiqueta="Comparativo por método de pago">
            <thead>
              <tr>
                <th>Método</th>
                <th className="ui-num">{NOMBRE_MES[datos.mes]} (Bs.)</th>
                <th className="ui-num">{NOMBRE_MES[datos.mesAnterior]} (Bs.)</th>
                <th className="ui-num">Variación</th>
              </tr>
            </thead>
            <tbody>
              {datos.porMetodo.map((m) => (
                <tr key={m.metodo}>
                  <td>{m.metodo}</td>
                  <td className="ui-num">{bs(m.actual)}</td>
                  <td className="ui-num">{bs(m.anterior)}</td>
                  <td className="ui-num">
                    <Variacion valor={m.variacion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </>
      )}
    </section>
  )
}

export default ComparativoMensual
