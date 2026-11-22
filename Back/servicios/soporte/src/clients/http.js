const { AppError } = require("../utils/AppError");

// Pide JSON a otro microservicio y traduce sus fallas a AppError.
// - 404 del otro servicio  -> 404 (el dato no existe)
// - otro error del servicio -> 502 (el status original queda en error.statusOrigen)
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
    const error = new AppError(`${servicio} respondió con error`, 502, (cuerpo && cuerpo.mensaje) || `HTTP ${respuesta.status}`);
    error.statusOrigen = respuesta.status; // p. ej. 401 si el token fue rechazado
    throw error;
  }
  return cuerpo;
}

module.exports = { pedirJson };
