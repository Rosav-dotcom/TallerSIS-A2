// Colores del sistema de diseño RePay para usar desde JavaScript.
// Solo para los casos donde no sirve var(--…): atributos SVG como fill y stroke.
// Deben coincidir con src/index.css y DESIGN_SYSTEM.md. En estilos normales usa var(--…).
export const COLOR = {
  navy: '#14213D',
  navyHover: '#1E2F55',
  olive: '#5C6236',
  oliveDark: '#474C29',
  gold: '#B08D4F',
  goldDark: '#8A6A35',
  bone: '#EFE8D8',
  border: '#D9CFBA',
  muted: '#5A6072',
  error: '#B42318',
}

// Serie de colores de marca para gráficos (navy, olive, gold y sus tonos).
export const SERIE_GRAFICO = [
  COLOR.navy,
  COLOR.olive,
  COLOR.gold,
  COLOR.muted,
  COLOR.navyHover,
  COLOR.oliveDark,
  COLOR.goldDark,
]
