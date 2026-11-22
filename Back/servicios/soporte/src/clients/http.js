const { AppError } = require("../utils/AppError");

// Pide JSON a otro microservicio y traduce sus fallas a AppError.
// - 404 del otro servicio  -> 404 (el dato no existe)
// - otro error del servicio -> 502 (respuesta inválida del servicio)
// - sin conexión / timeout  -> 503 (servicio no disponible)
// `fetchImpl` se puede reemplazar en los tests.
async function pedirJson(url, { servicio, fetchImpl = fetch, timeoutMs = 8000, ...opciones } = {}) {
  let respuesta;
  try {
    respuesta = await fetchImpl(url, { ...opciones, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new AppError(`No se pudo conectar con ${servicio}`, 503, e.message);
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (respuesta.status === 404) {
    throw new AppError((cuerpo && cuerpo.mensaje) || "No encontrado", 404);
  }
  if (!respuesta.ok) {
    throw new AppError(`${servicio} respondió con error`, 502, (cuerpo && cuerpo.mensaje) || `HTTP ${respuesta.status}`);
  }
  return cuerpo;
}

module.exports = { pedirJson };
