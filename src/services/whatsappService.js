let sockInstance = null;

export function setSocketInstance(sock) {
  sockInstance = sock;
}

function formatJid(target) {
  if (typeof target !== 'string') throw new Error(`Invalid target type: ${typeof target}`);

  if (target.includes('@')) return target;
  if (/^\d+$/.test(target)) return `${target}@s.whatsapp.net`;

  throw new Error(`Invalid target format: ${target}`);
}

export async function sendTextMessage(target, text) {
  if (!sockInstance) throw new Error("WhatsApp socket not initialized");

  const jid = formatJid(target);

  try {
    return await sockInstance.sendMessage(jid, { text });
  } catch (error) {
    console.error('❌ Failed to send text message:', error.message);
    throw error;
  }
}
