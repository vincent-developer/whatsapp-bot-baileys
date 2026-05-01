import stateManager from "../utils/stateManager.js";
import {
  COMMANDS,
  USER_STATE,
  MESSAGES,
  REGEX,
} from "../utils/constants.js";
import { sendTextMessage, sendDocument } from "../services/whatsappService.js";
import { generateDocx, cleanupTempFile } from "../services/docxGenerator.js";
import {
  getUpcomingChronological,
  getUpcomingChronologicalByPerson,
  formatJadwalNearestAndNext,
} from "../services/googleSheetsService.js";

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

    // Initiate conversion flow
    if (command === COMMANDS.CONVERT) {
      stateManager.setState(jid, USER_STATE.WAITING_FOR_TEXT);
      await sendTextMessage(jid, MESSAGES.ASK_TEXT);
      return;
    }

    // Schedule checker: nearest upcoming Mass(es) from Google Sheet
    if (command === COMMANDS.SCHEDULE) {
      await sendTextMessage(jid, MESSAGES.SCHEDULE_FETCHING);
      const result = await getUpcomingChronological();

      if (!result.ok) {
        await sendTextMessage(jid, MESSAGES.SCHEDULE_ERROR);
        stateManager.setState(jid, USER_STATE.IDLE);
        return;
      }

      if (!result.rows?.length) {
        await sendTextMessage(jid, MESSAGES.SCHEDULE_NONE_UPCOMING);
        stateManager.setState(jid, USER_STATE.IDLE);
        return;
      }

      const body = formatJadwalNearestAndNext(result.rows);
      await sendTextMessage(jid, `${body}${MESSAGES.SCHEDULE_HINT}`);
      stateManager.setState(jid, USER_STATE.WAITING_FOR_SCHEDULE_QUERY);
      return;
    }

    // --- State-based Logic ---

    // Handle input when user is expected to send text for document generation
    if (currentState === USER_STATE.WAITING_FOR_TEXT) {
      if (!messageText) {
        await sendTextMessage(
          jid,
          "Text cannot be empty. Please send valid text."
        );
        return;
      }

      await sendTextMessage(jid, MESSAGES.PROCESSING);

      // Generate document from provided text
      const result = await generateDocx(messageText);

      if (result.success) {
        await sendDocument(jid, result.filepath, MESSAGES.SUCCESS);
        cleanupTempFile(result.filepath); // Delete temp file after sending
      } else {
        await sendTextMessage(jid, MESSAGES.ERROR);
      }

      // Return user to IDLE state after completion
      stateManager.setState(jid, USER_STATE.IDLE);
      return;
    }

    // Follow-up: "<Name> tugas kapan?" (case-insensitive)
    if (currentState === USER_STATE.WAITING_FOR_SCHEDULE_QUERY) {
      const m = messageText.match(REGEX.SCHEDULE_QUERY);
      if (m) {
        const personName = (m[1] || "").trim();
        if (!personName) {
          await sendTextMessage(jid, MESSAGES.SCHEDULE_QUERY_HINT);
          stateManager.setState(jid, USER_STATE.WAITING_FOR_SCHEDULE_QUERY);
          return;
        }

        const byPerson = await getUpcomingChronologicalByPerson(personName);

        if (!byPerson.ok) {
          await sendTextMessage(jid, MESSAGES.SCHEDULE_ERROR);
          stateManager.setState(jid, USER_STATE.IDLE);
          return;
        }

        if (!byPerson.rows?.length) {
          const msg = MESSAGES.SCHEDULE_PERSON_NOT_FOUND.replace(
            "{name}",
            personName
          );
          await sendTextMessage(jid, msg);
          stateManager.setState(jid, USER_STATE.WAITING_FOR_SCHEDULE_QUERY);
          return;
        }

        const reply = formatJadwalNearestAndNext(byPerson.rows);
        await sendTextMessage(jid, reply);
        stateManager.setState(jid, USER_STATE.WAITING_FOR_SCHEDULE_QUERY);
        return;
      }

      await sendTextMessage(jid, MESSAGES.SCHEDULE_QUERY_HINT);
      stateManager.setState(jid, USER_STATE.WAITING_FOR_SCHEDULE_QUERY);
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
