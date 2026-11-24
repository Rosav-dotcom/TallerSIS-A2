// TDSI-77/1040: lee los acuses de Inventario de la suscripcion del topico del Grupo A. Es la misma
// suscripcion que leen Facturacion (Contabilidad) y Gestion de pagos (Marketplace y Compras):
// cada servicio confirma (ack) solo lo suyo y libera el resto. Mismo cliente que gestion_pagos.
const { v1 } = require("@google-cloud/pubsub");
const cfg = require("../config/inventario");

let cliente = null;

function obtenerCliente() {
  if (!cliente) {
    const cred = cfg.GOOGLE_CREDENTIALS;
    cliente = new v1.SubscriberClient(
      cred ? { projectId: cred.project_id, credentials: { client_email: cred.client_email, private_key: cred.private_key } } : {}
    );
  }
  return cliente;
}

/** Nombre completo de la suscripcion: acepta "projects/<p>/subscriptions/<s>" o solo "<s>". */
function nombreSuscripcion(suscripcion) {
  if (!suscripcion) return null;
  if (suscripcion.includes("/topics/"))
    throw new Error("La suscripcion configurada tiene un topico; debe ser una suscripcion (projects/<p>/subscriptions/<nombre> o solo <nombre>)");
  if (suscripcion.startsWith("projects/")) return suscripcion;
  const proyecto = cfg.GOOGLE_CREDENTIALS?.project_id;
  return `projects/${proyecto}/subscriptions/${suscripcion}`;
}

/** Trae hasta `max` mensajes: [{ ackId, messageId, atributos, texto }]. */
async function leer(max, suscripcion) {
  // returnImmediately: sin esto, pull() espera mensajes que no llegan y termina en DEADLINE_EXCEEDED.
  const [respuesta] = await obtenerCliente().pull(
    { subscription: suscripcion, maxMessages: max, returnImmediately: true },
    { timeout: cfg.PUBSUB_TIMEOUT_MS }
  );
  return (respuesta.receivedMessages || []).map(({ ackId, message }) => ({
    ackId,
    messageId: message.messageId,
    atributos: message.attributes || {},
    texto: Buffer.from(message.data || "").toString("utf8"),
  }));
}

/** Confirma los mensajes procesados (desaparecen de la suscripcion). */
async function confirmar(ackIds, suscripcion) {
  if (ackIds.length) await obtenerCliente().acknowledge({ subscription: suscripcion, ackIds });
}

/** Libera de inmediato los mensajes que no son de este servicio, para que otros los lean. */
async function liberar(ackIds, suscripcion) {
  if (ackIds.length) await obtenerCliente().modifyAckDeadline({ subscription: suscripcion, ackIds, ackDeadlineSeconds: 0 });
}

/** Solo para pruebas: reemplaza el cliente real por uno simulado (null vuelve al real). */
function usarClienteDePrueba(falso) {
  cliente = falso;
}

module.exports = { leer, confirmar, liberar, nombreSuscripcion, usarClienteDePrueba };
