// Valores de la tabla soporte.incidentes (TDSI-971).
export const TIPOS = [
  { valor: 'Facturacion', texto: 'Facturación' },
  { valor: 'Pagos', texto: 'Pagos' },
  { valor: 'Acceso', texto: 'Acceso' },
  { valor: 'Error del sistema', texto: 'Error del sistema' },
  { valor: 'Otro', texto: 'Otro' },
]

export const PRIORIDADES = [
  { valor: 'Baja', texto: 'Baja' },
  { valor: 'Media', texto: 'Media' },
  { valor: 'Alta', texto: 'Alta' },
  { valor: 'Critica', texto: 'Crítica' },
]

export const ESTADOS = ['Abierto', 'En proceso', 'Pendiente', 'Resuelto', 'Cerrado']

// Tono de los estados que el componente Chip no tiene en su lista.
export const TONO_ESTADO = { Abierto: 'info', 'En proceso': 'info', Cerrado: 'neutro' }
