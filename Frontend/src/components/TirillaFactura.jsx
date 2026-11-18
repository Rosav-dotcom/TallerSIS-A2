import React, { useState, useEffect } from 'react';
import { obtenerTirillaTexto, imprimirFactura, reimprimirFactura } from '../api/facturacion';

export default function TirillaFactura({
  numeroFactura = 'F-001' // Default para simular si no se provee
}) {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tirillaTexto, setTirillaTexto] = useState('Cargando vista previa...');
  
  const [estadoImpresion, setEstadoImpresion] = useState(null); // 'exito' | 'error' | null
  const [errorMensaje, setErrorMensaje] = useState('');
  const [simularFallo, setSimularFallo] = useState(false); // Para pruebas (TDSI-302)

  // TDSI-300: Obtener y mostrar una vista previa de la tirilla ANTES de imprimir
  useEffect(() => {
    if (mostrarModal) {
      obtenerTirillaTexto(numeroFactura)
        .then(texto => {
          setTirillaTexto(texto);
        })
        .catch(err => {
          setTirillaTexto('Error al obtener la vista previa de la factura: ' + err.message);
        });
    }
  }, [mostrarModal, numeroFactura]);

  // TDSI-94 y TDSI-296: Disparador de impresión con conexión al backend
  const ejecutarImpresion = async () => {
    try {
      setEstadoImpresion(null);
      setErrorMensaje('');

      if (simularFallo) {
        throw new Error('Impresora térmica desconectada o sin papel.');
      }

      // Llamar al endpoint del backend para mandar a imprimir
      await imprimirFactura(numeroFactura);

      setEstadoImpresion('exito');
      setMostrarModal(false);
      setTimeout(() => setEstadoImpresion(null), 5000);
    } catch (err) {
      // Si la factura ya fue impresa, capturar el 409 y sugerir reimpresión
      if (err.status === 409 || err.message.includes('ya fue impresa')) {
        const confirmar = window.confirm('La factura ya fue impresa. ¿Desea realizar una REIMPRESIÓN?');
        if (confirmar) {
          ejecutarReimpresion();
        } else {
          setEstadoImpresion('error');
          setErrorMensaje('Impresión cancelada (factura ya impresa).');
        }
      } else {
        setEstadoImpresion('error');
        setErrorMensaje(err.mensaje || err.message || 'Error de conexión con la impresora.');
      }
    }
  };

  const ejecutarReimpresion = async () => {
    try {
      setEstadoImpresion(null);
      setErrorMensaje('');
      await reimprimirFactura(numeroFactura, 'Copia solicitada por el usuario');
      setEstadoImpresion('exito');
      setMostrarModal(false);
      setTimeout(() => setEstadoImpresion(null), 5000);
    } catch (err) {
      setEstadoImpresion('error');
      setErrorMensaje(err.mensaje || err.message || 'Error al reimprimir.');
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', marginTop: '1rem' }}>
      
      {/* TDSI-299: Botón Imprimir factura en pantalla de venta */}
      <button
        type="button"
        onClick={() => {
          setEstadoImpresion(null);
          setMostrarModal(true);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0.65rem 1.25rem',
          backgroundColor: 'var(--navy)',
          color: 'var(--surface)',
          borderRadius: '8px',
          border: 'none',
          fontSize: '0.875rem',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: 'var(--sombra)'
        }}
      >
        <span>Imprimir Factura</span>
      </button>

      {/* TDSI-301: Mensaje de confirmación exitosa */}
      {estadoImpresion === 'exito' && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          backgroundColor: 'var(--success-bg)',
          border: '1px solid var(--success)',
          borderRadius: '8px',
          color: 'var(--success)',
          fontSize: '0.85rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          ✓ La factura fue enviada a la impresora de tirillas correctamente.
        </div>
      )}

      {/* TDSI-302: Mensaje de error cuando la impresora falla */}
      {estadoImpresion === 'error' && (
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          backgroundColor: 'var(--error-bg)',
          border: '1px solid var(--error)',
          borderRadius: '8px',
          color: 'var(--error)',
          fontSize: '0.85rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          ⚠️ Error: {errorMensaje || 'La impresora no responde o no se encuentra conectada al terminal POS.'}
        </div>
      )}

      {/* TDSI-300: Vista previa de la tirilla (Modal) */}
      {mostrarModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--overlay)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          
          <div style={{
            backgroundColor: 'var(--surface)',
            borderRadius: '16px',
            padding: '20px',
            maxWidth: '360px',
            width: '100%',
            boxShadow: 'var(--sombra)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text)' }}>
                Vista Previa de Tirilla - {numeroFactura}
              </span>
              <button
                onClick={() => setMostrarModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            {/* CUERPO DE LA TIRILLA CARGADA DEL BACKEND */}
            <div
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '16px',
                borderRadius: '6px',
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '0.78rem',
                color: 'var(--text)',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                maxHeight: '400px',
                overflowY: 'auto'
              }}
            >
              {tirillaTexto}
            </div>

            {/* CONTROLES DEL MODAL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* TDSI-302: Selector para probar el caso de error */}
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simularFallo}
                  onChange={(e) => setSimularFallo(e.target.checked)}
                />
                Simular fallo de conexión con impresora (Prueba TDSI-302)
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModal(false)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: 'var(--bone)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--muted)',
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarImpresion}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: 'var(--success)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--surface)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Imprimir Ahora
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}