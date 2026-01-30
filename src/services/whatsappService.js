import fs from 'fs';

let sockInstance = null;

export function setSocketInstance(sock) {
  sockInstance = sock;
}

/**
 * Helper internal untuk format JID agar DRY (Don't Repeat Yourself)
 */
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

export async function sendDocument(phoneNumber, filepath, caption = '') {
  if (!sockInstance) throw new Error("WhatsApp socket not initialized");
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const jid = formatJid(phoneNumber);

  try {
    const fileBuffer = fs.readFileSync(filepath);
    
    const payload = {
      document: fileBuffer,
      mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'document.docx', // Bisa disesuaikan atau ambil dari path
      caption: caption
    };
    
    return await sockInstance.sendMessage(jid, payload);
  } catch (error) {
    console.error('❌ Failed to send document:', error.message);
    throw error;
  }
}