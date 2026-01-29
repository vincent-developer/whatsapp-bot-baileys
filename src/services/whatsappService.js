import fs from 'fs';

let sockInstance = null;

export function setSocketInstance(sock) {
  sockInstance = sock;
}

export async function sendTextMessage(phoneNumber, text) {
  if (!sockInstance) {
    throw new Error('WhatsApp socket not initialized');
  }

  const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
  await sockInstance.sendMessage(jid, { text });
}

export async function sendDocument(phoneNumber, filepath, caption = '') {
  if (!sockInstance) {
    throw new Error('WhatsApp socket not initialized');
  }

  const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
  
  await sockInstance.sendMessage(jid, {
    document: fs.readFileSync(filepath),
    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileName: 'converted_document.docx',
    caption: caption
  });
}