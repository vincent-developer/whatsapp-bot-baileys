import stateManager from '../utils/stateManager.js';
import { COMMANDS, USER_STATE, MESSAGES } from '../utils/constants.js';
import { sendTextMessage, sendDocument } from '../services/whatsappService.js';
import { generateDocx, cleanupTempFile } from '../services/docxGenerator.js';

export async function handleIncomingMessage(message) {
  try {
    // Extract info dari message
    const remoteJid = message.key.remoteJid;
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';
    
    // Skip jika dari group atau broadcast
    if (!remoteJid.endsWith('@s.whatsapp.net')) {
      return;
    }

    // Extract phone number
    const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
    const currentState = stateManager.getState(phoneNumber);
    
    console.log(`📩 Message from ${phoneNumber}: "${messageText}" | State: ${currentState}`);

    // Handle commands
    const command = messageText.toLowerCase().trim();

    // Command: cancel
    if (command === COMMANDS.CANCEL) {
      stateManager.setState(phoneNumber, USER_STATE.IDLE);
      await sendTextMessage(phoneNumber, MESSAGES.CANCELLED);
      return;
    }

    // Command: help
    if (command === COMMANDS.HELP) {
      await sendTextMessage(phoneNumber, MESSAGES.HELP);
      return;
    }

    // Command: convert
    if (command === COMMANDS.CONVERT) {
      stateManager.setState(phoneNumber, USER_STATE.WAITING_FOR_TEXT);
      await sendTextMessage(phoneNumber, MESSAGES.ASK_TEXT);
      return;
    }

    // State: WAITING_FOR_TEXT
    if (currentState === USER_STATE.WAITING_FOR_TEXT) {
      if (!messageText || messageText.trim().length === 0) {
        await sendTextMessage(phoneNumber, 'Text tidak boleh kosong. Silahkan kirim text yang valid.');
        return;
      }

      // Proses convert
      await sendTextMessage(phoneNumber, MESSAGES.PROCESSING);
      
      const result = await generateDocx(messageText);
      
      if (result.success) {
        await sendDocument(phoneNumber, result.filepath, MESSAGES.SUCCESS);
        
        // Cleanup
        cleanupTempFile(result.filepath);
        stateManager.setState(phoneNumber, USER_STATE.IDLE);
      } else {
        await sendTextMessage(phoneNumber, MESSAGES.ERROR);
        stateManager.setState(phoneNumber, USER_STATE.IDLE);
      }
      
      return;
    }

    // Default: IDLE state
    if (currentState === USER_STATE.IDLE) {
      await sendTextMessage(phoneNumber, MESSAGES.WELCOME);
    }

  } catch (error) {
    console.error('❌ Error handling message:', error);
  }
}