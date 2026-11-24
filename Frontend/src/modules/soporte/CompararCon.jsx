import { useState } from 'react'
import { Boton, CampoTexto } from '../../components/ui'

// Pide el número del lado que falta para poder comparar.
function CompararCon({ etiqueta, ayuda, error, comparando, onComparar }) {
  const [valor, setValor] = useState('')
  return (
    <form
      className="sop-comparar"
      onSubmit={(e) => {
        e.preventDefault()
        onComparar(valor)
      }}
    >
      <CampoTexto
        etiqueta={etiqueta}
        ayuda={ayuda}
        error={error}
        autoComplete="off"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />
      <Boton type="submit" variante="contorno" disabled={comparando}>
        {comparando ? 'Comparando…' : 'Comparar'}
      </Boton>
    </form>
  )
}

export default CompararCon
