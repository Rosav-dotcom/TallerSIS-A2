import { useEffect } from 'react'
import { Aviso } from '../../components/ui'

const DURACION_MS = 6000

// TDSI-1094: aviso de éxito arriba a la derecha al escalar. Se cierra solo a los 6 s o con la X.
function AvisoEscalado({ numero, onCerrar }) {
  useEffect(() => {
    const temporizador = setTimeout(onCerrar, DURACION_MS)
    return () => clearTimeout(temporizador)
  }, [onCerrar])

  return (
    <div className="sop-aviso-flotante">
      <Aviso tono="exito" titulo="Incidente escalado" onCerrar={onCerrar}>
        {numero} pasó a Escalado. El administrador lo verá en su bandeja de incidentes escalados.
      </Aviso>
    </div>
  )
}

export default AvisoEscalado
