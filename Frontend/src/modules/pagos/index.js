import { FEATURES } from '../../config/features.js'

// Entrada del módulo Pagos del Sprint 4 (Equipo 2): App.jsx y las rutas solo importan de aquí.
export { default as ComprobanteReembolso } from './ComprobanteReembolso.jsx'
// La página cuelga de /devoluciones: se ve cuando el Equipo 1 enciende su interruptor.
export const COMPROBANTE_ACTIVO = FEATURES.devoluciones
