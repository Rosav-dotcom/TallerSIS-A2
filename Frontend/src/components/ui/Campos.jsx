import { useId, useRef, useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import './ui.css'
import Icono from './Icono.jsx'

// Contenedor común: etiqueta persistente, control, ayuda o error.
function Campo({ id, etiqueta, ayuda, error, deshabilitado, contador, children }) {
  const clases = ['ui-campo', deshabilitado && 'ui-campo--deshabilitado'].filter(Boolean).join(' ')
  return (
    <div className={clases}>
      {etiqueta && (
        <label className="ui-campo-etiqueta" htmlFor={id}>
          {etiqueta}
        </label>
      )}
      {children}
      {(error || ayuda || contador) && (
        <div className="ui-campo-pie">
          {error ? (
            <span id={`${id}-mensaje`} className="ui-campo-error" role="alert">
              {error}
            </span>
          ) : (
            ayuda && (
              <span id={`${id}-mensaje`} className="ui-campo-ayuda">
                {ayuda}
              </span>
            )
          )}
          {contador && <span className="ui-campo-contador">{contador}</span>}
        </div>
      )}
    </div>
  )
}

function clasesControl(error, deshabilitado, extra) {
  return ['ui-control', error && 'ui-control--error', deshabilitado && 'ui-control--deshabilitado', extra]
    .filter(Boolean)
    .join(' ')
}

// Campo de texto. prefijo: texto fijo a la izquierda (ej. "Bs"). icono: a la izquierda. accion: nodo a la derecha.
export function CampoTexto({ etiqueta, ayuda, error, prefijo, icono, accion, id, disabled, ...resto }) {
  const generado = useId()
  const idCampo = id || generado
  return (
    <Campo id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error} deshabilitado={disabled}>
      <div className={clasesControl(error, disabled)}>
        {icono && (
          <span className="ui-control-icono">
            <Icono icono={icono} />
          </span>
        )}
        {prefijo && <span className="ui-control-prefijo">{prefijo}</span>}
        <input
          id={idCampo}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || ayuda ? `${idCampo}-mensaje` : undefined}
          {...resto}
        />
        {accion}
      </div>
    </Campo>
  )
}

// Contraseña con botón de mostrar u ocultar.
export function CampoContrasena(props) {
  const [visible, setVisible] = useState(false)
  return (
    <CampoTexto
      {...props}
      type={visible ? 'text' : 'password'}
      accion={
        <button
          type="button"
          className="ui-control-boton"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          disabled={props.disabled}
        >
          <Icono icono={visible ? EyeOff : Eye} />
        </button>
      }
    />
  )
}

// Selector desplegable. Recibe sus <option> como hijos.
export function Selector({ etiqueta, ayuda, error, id, disabled, children, ...resto }) {
  const generado = useId()
  const idCampo = id || generado
  return (
    <Campo id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error} deshabilitado={disabled}>
      <div className={clasesControl(error, disabled)}>
        <select id={idCampo} disabled={disabled} aria-invalid={error ? true : undefined} {...resto}>
          {children}
        </select>
        <span className="ui-control-icono">
          <Icono icono={ChevronDown} />
        </span>
      </div>
    </Campo>
  )
}

// Área de texto con contador "0/300" cuando se indica maxLength.
export function AreaTexto({ etiqueta, ayuda, error, id, disabled, maxLength, value = '', ...resto }) {
  const generado = useId()
  const idCampo = id || generado
  const contador = maxLength ? `${String(value).length}/${maxLength}` : null
  return (
    <Campo id={idCampo} etiqueta={etiqueta} ayuda={ayuda} error={error} deshabilitado={disabled} contador={contador}>
      <div className={clasesControl(error, disabled, 'ui-control--area')}>
        <textarea
          id={idCampo}
          disabled={disabled}
          maxLength={maxLength}
          value={value}
          aria-invalid={error ? true : undefined}
          {...resto}
        />
      </div>
    </Campo>
  )
}

// PIN de autorización de N dígitos (4 por defecto). value: texto con los dígitos; onChange(nuevoValor).
export function CampoPin({
  etiqueta = 'PIN de autorización',
  ayuda,
  error,
  value = '',
  onChange,
  longitud = 4,
  disabled,
}) {
  const generado = useId()
  const refs = useRef([])
  const digitos = Array.from({ length: longitud }, (_, i) => value[i] || '')

  function cambiar(i, texto) {
    const digito = texto.replace(/\D/g, '').slice(-1)
    const nuevo = digitos.map((d, j) => (j === i ? digito : d)).join('')
    onChange?.(nuevo)
    if (digito && i < longitud - 1) refs.current[i + 1]?.focus()
  }

  function tecla(i, e) {
    if (e.key === 'Backspace' && !digitos[i] && i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <Campo id={`${generado}-0`} etiqueta={etiqueta} ayuda={ayuda} error={error} deshabilitado={disabled}>
      <div className={['ui-pin', error && 'ui-pin--error'].filter(Boolean).join(' ')}>
        {digitos.map((d, i) => (
          <input
            key={i}
            id={`${generado}-${i}`}
            ref={(el) => (refs.current[i] = el)}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            value={d}
            disabled={disabled}
            aria-label={`Dígito ${i + 1} de ${longitud}`}
            onChange={(e) => cambiar(i, e.target.value)}
            onKeyDown={(e) => tecla(i, e)}
          />
        ))}
      </div>
    </Campo>
  )
}

// Casilla de verificación con su texto.
export function Casilla({ children, disabled, ...resto }) {
  return (
    <label className={['ui-casilla', disabled && 'ui-casilla--deshabilitado'].filter(Boolean).join(' ')}>
      <input type="checkbox" disabled={disabled} {...resto} />
      <span className="ui-casilla-caja" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12l5 5L19 7" />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  )
}
