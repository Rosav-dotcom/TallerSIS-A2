import { useEffect, useState } from 'react'
import { obtenerLibroVentas, descargarLibroVentasExcel } from '../api/libroVentas.js'
import { Download } from 'lucide-react'
import { Alerta, Boton, CampoTexto, Chip, EstadoVacio, Selector, Tabla } from '../components/ui'
import './turno.css'
import './admin.css'

const MESES = [
  { valor: 1, etiqueta: 'Enero' },
  { valor: 2, etiqueta: 'Febrero' },
  { valor: 3, etiqueta: 'Marzo' },
  { valor: 4, etiqueta: 'Abril' },
  { valor: 5, etiqueta: 'Mayo' },
  { valor: 6, etiqueta: 'Junio' },
  { valor: 7, etiqueta: 'Julio' },
  { valor: 8, etiqueta: 'Agosto' },
  { valor: 9, etiqueta: 'Septiembre' },
  { valor: 10, etiqueta: 'Octubre' },
  { valor: 11, etiqueta: 'Noviembre' },
  { valor: 12, etiqueta: 'Diciembre' },
]

const ETIQUETA_ESTADO = { V: 'Vigente', A: 'Anulada' }

const hoy = new Date()

const bs = (v) => Number(v ?? 0).toFixed(2)

// TDSI-178/751-754: pantalla "Libro de Ventas" del Administrador -- IVA del mes
// elegido, con vista previa en tabla y descarga del mismo libro en Excel.
function LibroVentas() {
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())

  const [libro, setLibro] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    obtenerLibroVentas(mes, anio)
      .then((data) => vigente && setLibro(data))
      .catch((err) => vigente && setError(err.message))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [mes, anio])

  async function descargarExcel() {
    setDescargando(true)
    setErrorDescarga(null)
    try {
      const blob = await descargarLibroVentasExcel(mes, anio)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `libro-ventas-${anio}-${String(mes).padStart(2, '0')}.xlsx`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setErrorDescarga(err.message)
    } finally {
      setDescargando(false)
    }
  }

  const hayFilas = libro && libro.filas.length > 0

  return (
    <section className="adm-pagina">
      <div className="turno-encabezado">
        <h1>Libro de Ventas</h1>
        <p>IVA del mes elegido: importe base y débito fiscal (13%) de cada factura emitida.</p>
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
        <Boton icono={Download} onClick={descargarExcel} disabled={descargando || !hayFilas}>
          {descargando ? 'Descargando...' : 'Descargar Libro de Ventas'}
        </Boton>
      </div>

      {errorDescarga && <Alerta tono="error" titulo={`No se pudo descargar el Excel: ${errorDescarga}`} />}

      {cargando && <p className="adm-nota">Cargando...</p>}
      {!cargando && error && <Alerta tono="error" titulo={`Error: ${error}`} />}

      {!cargando && !error && !hayFilas && <EstadoVacio titulo="No hay facturas en este mes." />}

      {!cargando && !error && hayFilas && (
        <div className="adm-sin-cortes">
          <Tabla etiqueta="Libro de Ventas">
            <thead>
              <tr>
                <th className="ui-num">N°</th>
                <th>Fecha</th>
                <th>N° Factura</th>
                <th>NIT/CI</th>
                <th>Razón social</th>
                <th className="ui-num">Total (Bs.)</th>
                <th className="ui-num">Descuento (Bs.)</th>
                <th className="ui-num">Importe base (Bs.)</th>
                <th className="ui-num">Débito fiscal (Bs.)</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {libro.filas.map((f) => (
                <tr key={f.numero_factura} className={f.estado === 'A' ? 'adm-fila-anulada' : ''}>
                  <td className="ui-num">{f.numero}</td>
                  <td>{new Date(f.fecha).toLocaleDateString()}</td>
                  <td>{f.numero_factura}</td>
                  <td>{f.nit_ci || '—'}</td>
                  <td>{f.razon_social}</td>
                  <td className="ui-num">{bs(f.total)}</td>
                  <td className="ui-num">{bs(f.descuento)}</td>
                  <td className="ui-num">{bs(f.importe_base)}</td>
                  <td className="ui-num">{bs(f.debito_fiscal)}</td>
                  <td>
                    <Chip tono={f.estado === 'A' ? 'neutro' : 'exito'}>{ETIQUETA_ESTADO[f.estado] ?? f.estado}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>Totales del mes</th>
                <td className="ui-num">{bs(libro.totales.total)}</td>
                <td className="ui-num">{bs(libro.totales.descuento)}</td>
                <td className="ui-num">{bs(libro.totales.importe_base)}</td>
                <td className="ui-num">{bs(libro.totales.debito_fiscal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </Tabla>
        </div>
      )}
    </section>
  )
}

export default LibroVentas
