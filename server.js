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
import { setSocketInstance } from "./src/services/whatsappService.js";
import { handleIncomingMessage } from "./src/handlers/messageHandler.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let waReady = false;

/**
 * Bearer Token Middleware
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
 * WhatsApp Initialization
 */
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false
  });

  // Set socket instance untuk services
  setSocketInstance(sock);

  sock.ev.on("creds.update", saveCreds);

  // Handle incoming messages
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type === "notify") {
      for (const message of messages) {
        // Skip jika message dari diri sendiri
        if (message.key.fromMe) continue;
        
        await handleIncomingMessage(message);
      }
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("\n📌 Scan WhatsApp QR Code:\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      waReady = true;
      console.log("✅ WhatsApp connected");
    }

    if (connection === "close") {
      waReady = false;

      const reason = lastDisconnect?.error?.output?.statusCode;
      console.warn("⚠ WhatsApp connection closed:", reason);

      if (reason !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting WhatsApp...");
        startWhatsApp();
      } else {
        console.error("❌ Session expired. Delete `auth_info_baileys` folder and re-scan QR.");
      }
    }
  });
}

/**
 * API Routes
 */

// Health check (public)
app.get("/status", (req, res) => {
  res.json({
    connected: waReady,
    whatsapp_status: waReady ? "READY" : "NOT CONNECTED",
    timestamp: new Date().toISOString()
  });
});

// Send message (protected)
app.post("/send-message", authenticateToken, async (req, res) => {
  if (!waReady) {
    return res.status(503).json({
      success: false,
      error: "WhatsApp session is not connected."
    });
  }

  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({
      success: false,
      error: "`number` and `message` are required."
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
    await sock.sendMessage(jid, { text: message });

    res.json({
      success: true,
      to: number,
      text: message
    });
  } catch (err) {
    console.error("❌ Failed to send message:", err);

    res.status(500).json({
      success: false,
      error: "Failed to send message."
    });
  }
});

/**
 * Environment validation
 */
if (!process.env.API_BEARER_TOKEN) {
  console.error("❌ API_BEARER_TOKEN is not set");
  process.exit(1);
}

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
startWhatsApp();

app.listen(PORT, () => {
  console.log(`🌍 WhatsApp API running on port ${PORT}`);
});