import stateManager from "../utils/stateManager.js";
import { COMMANDS, USER_STATE, MESSAGES } from "../utils/constants.js";
import { sendTextMessage, sendDocument } from "../services/whatsappService.js";
import { generateDocx, cleanupTempFile } from "../services/docxGenerator.js";
import {
  validateScribdUrl,
  downloadScribdToTemp,
} from "../services/scribdService.js";

/**
 * Main handler for incoming WhatsApp messages
 */
export async function handleIncomingMessage(message) {
  try {
    const jid = message.key.remoteJid;

    // Extract message text from various possible structures
    const messageText = (
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      ""
    ).trim();

    // Ignore messages from groups or broadcast status
    if (jid.includes("@g.us") || jid.includes("@broadcast")) return;

    // Get current user interaction state
    const currentState = stateManager.getState(jid);
    const command = messageText.toLowerCase();

    // --- Global Commands ---

    // Reset state to IDLE if user cancels
    if (command === COMMANDS.CANCEL) {
      stateManager.setState(jid, USER_STATE.IDLE);
      await sendTextMessage(jid, MESSAGES.CANCELLED);
      return;
    }

    // Show help information
    if (command === COMMANDS.HELP) {
      await sendTextMessage(jid, MESSAGES.HELP);
      return;
    }

    // Initiate LCD conversion flow
    if (command === COMMANDS.CONVERT) {
      stateManager.setState(jid, USER_STATE.WAITING_FOR_TEXT);
      await sendTextMessage(jid, MESSAGES.ASK_TEXT);
      return;
    }

    // Initiate Scribd download flow
    if (command === COMMANDS.SCRIBD) {
      stateManager.setState(jid, USER_STATE.WAITING_FOR_SCRIBD_URL);
      await sendTextMessage(jid, MESSAGES.ASK_SCRIBD_URL);
      return;
    }

    // --- State-based Logic ---

    // Handle input when user is expected to send text for document generation
    if (currentState === USER_STATE.WAITING_FOR_TEXT) {
      if (!messageText) {
        await sendTextMessage(jid, "Text cannot be empty. Please send valid text.");
        return;
      }

      await sendTextMessage(jid, MESSAGES.PROCESSING);

      const result = await generateDocx(messageText);

      try {
        if (result.success) {
          await sendDocument(jid, result.filepath, MESSAGES.SUCCESS);
        } else {
          await sendTextMessage(jid, MESSAGES.ERROR);
        }
      } finally {
        if (result.filepath) cleanupTempFile(result.filepath);
        stateManager.setState(jid, USER_STATE.IDLE);
      }
      return;
    }

    // Handle Scribd URL input
    if (currentState === USER_STATE.WAITING_FOR_SCRIBD_URL) {
      if (!messageText || !validateScribdUrl(messageText)) {
        await sendTextMessage(jid, MESSAGES.INVALID_SCRIBD_URL);
        return;
      }

      await sendTextMessage(jid, MESSAGES.PROCESSING_SCRIBD);

      let result;
      try {
        result = await downloadScribdToTemp(messageText);

        if (result.success) {
          await sendDocument(jid, result.filepath, MESSAGES.SUCCESS_SCRIBD);
        } else {
          await sendTextMessage(jid, MESSAGES.ERROR_SCRIBD);
        }
      } catch (error) {
        console.error("Scribd flow error:", error.message);
        await sendTextMessage(jid, MESSAGES.ERROR_SCRIBD);
      } finally {
        if (result?.filepath) cleanupTempFile(result.filepath);
        stateManager.setState(jid, USER_STATE.IDLE);
      }
      return;
    }

    // Default response for unknown commands in IDLE state
    if (currentState === USER_STATE.IDLE) {
      //for now disabled because will spam whoever chat on that whatsapp
      // await sendTextMessage(jid, MESSAGES.WELCOME);
    }

  } catch (error) {
    // Log only critical errors
    console.error("Critical error in handleIncomingMessage:", error.message);
  }
}
