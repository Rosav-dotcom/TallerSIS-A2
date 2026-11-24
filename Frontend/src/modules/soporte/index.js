import { FEATURES } from '../../config/features.js'

// Entrada del módulo Soporte: App.jsx solo importa de aquí.
export { default as Soporte } from './Soporte.jsx'
export { default as SoporteIncidente } from './SoporteIncidente.jsx'
export const SOPORTE_ACTIVO = FEATURES.soporte
export const DETALLE_ACTIVO = FEATURES.soporte && FEATURES.soporteDetalle
