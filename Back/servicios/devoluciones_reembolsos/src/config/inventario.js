// TDSI-77: aviso de devoluciones al Modulo de Gestion de Inventarios y Almacen por Google Pub/Sub.
// Sin INVENTARIO_PUBSUB_TOPIC no se publica nada (desarrollo local sin credenciales): el aviso
// queda Pendiente y se envia cuando se configure.
function entero(nombre, defecto, min, max) {
  const v = Number(process.env[nombre] ?? defecto);
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`${nombre} debe ser un entero entre ${min} y ${max}`);
  return v;
}

function topico(nombre) {
  const v = String(process.env[nombre] || "").trim();
  if (v && !/^(projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/)?[A-Za-z][\w.~+%-]{2,254}$/.test(v))
    throw new Error(`${nombre} debe tener la forma projects/<proyecto>/topics/<topico>`);
  return v || null;
}

// La llave de la cuenta de servicio pegada en el .env (JSON en una linea o base64).
// Si no esta, la libreria usa GOOGLE_APPLICATION_CREDENTIALS (ruta al archivo).
function credencialesGoogle(nombre) {
  const v = String(process.env[nombre] || "").trim();
  if (!v) return null;
  const texto = v.startsWith("{") ? v : Buffer.from(v, "base64").toString("utf8");
  let cred;
  try {
    cred = JSON.parse(texto);
  } catch {
    // Con comillas dobles dotenv convierte los \n de private_key en saltos reales: se devuelven a \n.
    try { cred = JSON.parse(texto.replace(/\r?\n/g, "\\n")); } catch { cred = null; }
  }
  if (!cred) {
    throw new Error(`${nombre} no es un JSON valido (pegalo en una sola linea entre comillas simples, o en base64)`);
  }
  if (!cred.client_email || !cred.private_key || !cred.project_id)
    throw new Error(`${nombre} debe tener project_id, client_email y private_key`);
  return { project_id: cred.project_id, client_email: cred.client_email, private_key: cred.private_key };
}

module.exports = {
  PUBSUB_TOPIC: topico("INVENTARIO_PUBSUB_TOPIC"),
  GOOGLE_CREDENTIALS: credencialesGoogle("GOOGLE_CREDENTIALS_JSON"),
  PUBSUB_TIMEOUT_MS: entero("PUBSUB_TIMEOUT_MS", 10000, 1000, 60000),
  // TDSI-1039: hasta 5 intentos automaticos; despues queda en Error (con "Reenviar")
  MAX_INTENTOS: entero("INVENTARIO_MAX_INTENTOS", 5, 1, 10),
  BACKOFF_BASE_SEG: entero("INVENTARIO_BACKOFF_BASE_SEG", 30, 1, 3600),
  INTERVALO_WORKER_SEG: entero("INVENTARIO_INTERVALO_WORKER_SEG", 15, 5, 3600),
  // TDSI-1040: acuses de Inventario en NUESTRO topico (Grupo A). Vacio = no se leen.
  ACUSES_SUBSCRIPTION: String(process.env.INVENTARIO_ACUSES_SUBSCRIPTION || "").trim() || null,
  ACUSES_INTERVALO_SEG: entero("INVENTARIO_ACUSES_INTERVALO_SEG", 30, 10, 3600),
};
