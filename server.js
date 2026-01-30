import express from "express";
import cors from "cors";
import qrcode from "qrcode-terminal";
import dotenv from "dotenv";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";
import { setSocketInstance, sendTextMessage } from "./src/services/whatsappService.js";
import { handleIncomingMessage } from "./src/handlers/messageHandler.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let waReady = false;

/**
 * Bearer Token Middleware for API security
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Access denied. No token provided."
    });
  }

  if (token !== process.env.API_BEARER_TOKEN) {
    return res.status(403).json({
      success: false,
      error: "Invalid token."
    });
  }

  next();
};

/**
 * Initialize WhatsApp connection
 */
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false
  });

  // Share socket instance with other services
  setSocketInstance(sock);

  sock.ev.on("creds.update", saveCreds);

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "notify") {
      for (const message of messages) {
        // Ignore self-sent messages
        if (message.key.fromMe) continue;
        await handleIncomingMessage(message);
      }
    }
  });

  // Handle connection lifecycle
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("📌 New QR Code generated. Please scan:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      waReady = true;
      console.log("✅ WhatsApp connection established");
    }

    if (connection === "close") {
      waReady = false;
      const reason = lastDisconnect?.error?.output?.statusCode;
      
      if (reason !== DisconnectReason.loggedOut) {
        console.log("🔄 Connection lost. Attempting to reconnect...");
        startWhatsApp();
      } else {
        console.error("❌ Session expired. Please delete 'auth_info_baileys' and re-scan.");
      }
    }
  });
}

/**
 * Public Route: Health Check
 */
app.get("/status", (req, res) => {
  res.json({
    connected: waReady,
    whatsapp_status: waReady ? "READY" : "NOT CONNECTED",
    timestamp: new Date().toISOString()
  });
});

/**
 * Protected Route: Send Text Message
 */
app.post("/send-message", authenticateToken, async (req, res) => {
  if (!waReady) {
    return res.status(503).json({
      success: false,
      error: "WhatsApp session is not connected."
    });
  }

  const { number, message } = req.body;

  // Validate input presence and format
  if (!number || !message) {
    return res.status(400).json({
      success: false,
      error: "Number and message are required."
    });
  }

  if (!/^\d+$/.test(number)) {
    return res.status(400).json({
      success: false,
      error: "Phone number must contain digits only."
    });
  }

  try {
    const jid = `${number}@s.whatsapp.net`;
    await sendTextMessage(jid, message);

    res.json({
      success: true,
      to: number,
      text: message
    });
  } catch (err) {
    console.error("❌ Error sending message:", err.message);
    res.status(500).json({
      success: false,
      error: "Failed to send message."
    });
  }
});

/**
 * Bootstrap Application
 */
if (!process.env.API_BEARER_TOKEN) {
  console.error("❌ API_BEARER_TOKEN is missing in .env file");
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
startWhatsApp();

app.listen(PORT, () => {
  console.log(`🌍 Server active on port ${PORT}`);
});