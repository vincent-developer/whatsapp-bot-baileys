import stateManager from "../utils/stateManager.js";
import { COMMANDS, USER_STATE, MESSAGES } from "../utils/constants.js";
import { sendTextMessage } from "../services/whatsappService.js";
import { getByNumber, formatPoMessage } from "../services/poService.js";
import {
  getByLifnr,
  maskVendorName,
  verifyContact
} from "../services/vendorAuthService.js";

/**
 * Main handler for incoming WhatsApp messages
 */
export async function handleIncomingMessage(message) {
  const jid = message.key.remoteJid;

  try {
    const messageText = (
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      ""
    ).trim();

    if (jid.includes("@g.us") || jid.includes("@broadcast")) return;

    const currentState = stateManager.getState(jid);
    const command = messageText.toLowerCase();

    if (command === COMMANDS.CANCEL) {
      stateManager.setState(jid, USER_STATE.IDLE);
      await sendTextMessage(jid, MESSAGES.CANCELLED);
      return;
    }

    if (command === COMMANDS.HELP) {
      await sendTextMessage(jid, MESSAGES.HELP);
      return;
    }

    if (command === COMMANDS.PO) {
      stateManager.setState(jid, USER_STATE.WAITING_FOR_PO);
      await sendTextMessage(jid, MESSAGES.ASK_PO_NUMBER);
      return;
    }

    if (currentState === USER_STATE.WAITING_FOR_PO) {
      if (!/^\d+$/.test(messageText)) {
        await sendTextMessage(jid, MESSAGES.PO_INVALID);
        return;
      }

      const po = await getByNumber(messageText);

      if (!po) {
        await sendTextMessage(jid, MESSAGES.PO_NOT_FOUND);
        stateManager.setState(jid, USER_STATE.IDLE);
        return;
      }

      const vendor = await getByLifnr(po.LIFNR);
      if (!vendor) {
        await sendTextMessage(jid, MESSAGES.CHALLENGE_UNAVAILABLE);
        stateManager.setState(jid, USER_STATE.IDLE);
        return;
      }

      stateManager.setState(jid, USER_STATE.WAITING_FOR_CHALLENGE, {
        ebeln: po.EBELN,
        lifnr: po.LIFNR
      });

      const maskedName = maskVendorName(vendor.NAME1 || po.NAME1);
      await sendTextMessage(jid, MESSAGES.ASK_CHALLENGE(maskedName));
      return;
    }

    if (currentState === USER_STATE.WAITING_FOR_CHALLENGE) {
      const context = stateManager.getContext(jid);

      if (!context?.ebeln || !context?.lifnr) {
        stateManager.setState(jid, USER_STATE.IDLE);
        await sendTextMessage(jid, MESSAGES.PO_NOT_FOUND);
        return;
      }

      const isValid = await verifyContact(context.lifnr, messageText);
      if (!isValid) {
        await sendTextMessage(jid, MESSAGES.CHALLENGE_FAILED);
        return;
      }

      const po = await getByNumber(context.ebeln);
      if (!po) {
        stateManager.setState(jid, USER_STATE.IDLE);
        await sendTextMessage(jid, MESSAGES.PO_NOT_FOUND);
        return;
      }

      await sendTextMessage(jid, MESSAGES.VERIFIED);
      await sendTextMessage(jid, formatPoMessage(po));
      stateManager.setState(jid, USER_STATE.IDLE);
      return;
    }

    if (currentState === USER_STATE.IDLE) {
      await sendTextMessage(jid, MESSAGES.WELCOME);
    }
  } catch (error) {
    console.error("Critical error in handleIncomingMessage:", error.message);
    try {
      stateManager.setState(jid, USER_STATE.IDLE);
      await sendTextMessage(jid, MESSAGES.ERROR);
    } catch (notifyError) {
      console.error("Failed to notify user about error:", notifyError.message);
    }
  }
}
