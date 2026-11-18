import { ScanBarcode, Search } from 'lucide-react'
import { Icono } from './ui'

export default function BuscadorFacturas({
  valor,
  onChange,
  placeholder = 'Buscar por N° de factura, NIT/CI o cliente',
}) {
  return (
    <span className="ui-control">
      <span className="ui-control-icono">
        <Icono icono={Search} />
      </span>
      <input
        type="search"
        value={valor}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Buscar facturas por número, NIT/CI o nombre del cliente"
        autoComplete="off"
      />
      <span className="ui-control-icono">
        <Icono icono={ScanBarcode} />
      </span>
    </span>
  )
}
