import { FEATURES } from '../../config/features.js'

// Entrada del módulo Soporte: App.jsx solo importa de aquí.
export { default as Soporte } from './Soporte.jsx'
export { default as BandejaIncidentes } from './BandejaIncidentes.jsx'
export { default as HistorialUsuario } from './HistorialUsuario.jsx'
export const SOPORTE_ACTIVO = FEATURES.soporte
