import { useState } from 'react';
import { calcularPagoMixto } from '../api/pagos';
import DesgloseVuelto from './DesgloseVuelto.jsx';
import { Alerta, Boton, CampoTexto, Chip, Tarjeta } from './ui';

// TDSI-88: División de montos entre 2 métodos de pago. Este componente ya NO
// finaliza el cobro (eso lo hace el formulario principal de Pagos.jsx con el
// botón "Continuar" / "Confirmar cobro"): aquí solo se capturan los montos y
// el botón "Validar montos" únicamente confirma que la suma cuadra con el total.
// TDSI-793: si uno de los métodos es Efectivo, se captura cuánto dio el cliente y se muestra
// el desglose del vuelto, que Pagos.jsx pide al backend (no cambia cómo se registra el pago).
export default function PagoMixtoForm({
  totalVenta = 0,
  metodo1,
  metodo2,
  monto1,
  monto2,
  onCambiarMonto1,
  onCambiarMonto2,
  montoRecibido = '',
  onCambiarMontoRecibido,
  vuelto = null,
  desgloseVuelto = [],
  calculandoVuelto = false,
  errorVuelto = null,
}) {
  const [validacion, setValidacion] = useState(null); // { ok, mensaje } | null
  const [validando, setValidando] = useState(false);

  const numMonto1 = parseFloat(monto1) || 0;
  const numMonto2 = parseFloat(monto2) || 0;
  const sumaTotal = +(numMonto1 + numMonto2).toFixed(2);
  const diferencia = +(totalVenta - sumaTotal).toFixed(2);
  const montosCompletos = numMonto1 > 0 && numMonto2 > 0;
  const incluyeEfectivo = metodo1 === 'Efectivo' || metodo2 === 'Efectivo';

  const evitarCaracteresInvalidos = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const manejarCambioMonto = (onCambiar) => (e) => {
    const valor = e.target.value;
    if (valor === '' || parseFloat(valor) >= 0) onCambiar(valor);
    setValidacion(null);
  };

  const validarMontos = async (e) => {
    e.preventDefault();
    if (!montosCompletos) return;

    setValidando(true);
    setValidacion(null);

    const payloadCalculo = {
      total: Number(totalVenta.toFixed(2)),
      metodos: [
        { metodo: metodo1, monto: numMonto1 },
        { metodo: metodo2, monto: numMonto2 },
      ],
    };

    try {
      await calcularPagoMixto(payloadCalculo);
      setValidacion({ ok: true, mensaje: 'Los montos son correctos: puede continuar con el cobro.' });
    } catch (error) {
      setValidacion({ ok: false, mensaje: error.mensaje || error.message || 'Los montos no son válidos.' });
    } finally {
      setValidando(false);
    }
  };

  return (
    <Tarjeta titulo="Pago mixto" acciones={<Chip tono="info">Total: Bs. {totalVenta.toFixed(2)}</Chip>}>
      <form onSubmit={validarMontos} className="cob-bloque">
        <div className="cob-mixto-montos">
          <CampoTexto
            etiqueta={metodo1}
            prefijo="Bs"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={monto1}
            onKeyDown={evitarCaracteresInvalidos}
            onChange={manejarCambioMonto(onCambiarMonto1)}
          />
          <CampoTexto
            etiqueta={metodo2}
            prefijo="Bs"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={monto2}
            onKeyDown={evitarCaracteresInvalidos}
            onChange={manejarCambioMonto(onCambiarMonto2)}
          />
        </div>

        {/* Resumen dinámico: suma registrada y si cuadra con el total */}
        <div className="cob-mixto-suma">
          <span>Suma registrada: Bs. {sumaTotal.toFixed(2)}</span>
          {diferencia === 0 && montosCompletos ? (
            <span className="cob-mixto-estado--ok">✓ Montos cuadrados</span>
          ) : (
            <span className="cob-mixto-estado--pendiente">
              {diferencia > 0 ? `Faltan Bs. ${diferencia.toFixed(2)}` : `Excede Bs. ${Math.abs(diferencia).toFixed(2)}`}
            </span>
          )}
        </div>

        {incluyeEfectivo && (
          <div className="cob-bloque">
            <CampoTexto
              id="efectivo-recibido-mixto"
              etiqueta="Efectivo recibido del cliente (opcional, para calcular el vuelto)"
              prefijo="Bs"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={montoRecibido}
              onKeyDown={evitarCaracteresInvalidos}
              onChange={manejarCambioMonto(onCambiarMontoRecibido)}
            />

            {montoRecibido && !(diferencia === 0 && montosCompletos) && (
              <p className="cob-nota">El vuelto se calcula cuando los montos cuadren con el total.</p>
            )}
            {calculandoVuelto && <p className="cob-nota">Calculando vuelto...</p>}
            {errorVuelto && !calculandoVuelto && <Alerta tono="error" titulo={errorVuelto} />}
            {vuelto !== null && !calculandoVuelto && <DesgloseVuelto vuelto={vuelto} desglose={desgloseVuelto} />}
          </div>
        )}

        {validacion && <Alerta tono={validacion.ok ? 'exito' : 'advertencia'} titulo={validacion.mensaje} />}

        <Boton type="submit" ancho disabled={!montosCompletos || validando}>
          {validando ? 'Validando...' : 'Validar montos'}
        </Boton>
      </form>
    </Tarjeta>
  );
}
