import express from "express";
import cors from "cors";
import fs from "fs";
import qrcode from "qrcode-terminal";
import path from "path";
import {
  default as makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys";

const app = express();
app.use(express.json());
app.use(cors());

let sock;
let waReady = false;

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false
  });

  sock.ev.on("creds.update", saveCreds);

// Di bagian connection.update handler:
sock.ev.on("connection.update", (update) => {
  const { connection, qr, lastDisconnect } = update;

  if (qr) {
    console.log("\n📌 Scan this WhatsApp QR Code:\n");
    qrcode.generate(qr, { small: true });
  }

  if (connection === "open") {
    console.log("🚀 WhatsApp Connected!");
    waReady = true;
  }

  if (connection === "close") {
    const reason = lastDisconnect?.error?.output?.statusCode;
    console.log("⚠ Connection closed. Reason code:", reason);
    
    waReady = false; // Set ke false dulu

    if (reason === DisconnectReason.loggedOut) {
      console.log("❌ Session expired (logged out from another device)");
      console.log("🗑️ Cleaning up auth folder...");
      
      // Cleanup socket
      if (sock) {
        sock.ev.removeAllListeners();
        sock = null;
      }
      
      // Hapus folder auth otomatis
      deleteAuthFolder();
      
      console.log("📱 Please restart the server and scan QR code again");
      
      // Optional: auto-restart after cleanup
      setTimeout(() => {
        console.log("🔄 Auto-restarting...");
        startWhatsApp();
      }, 2000);
      
    } else {
      // Disconnect karena alasan lain (network, restart, dll)
      console.log("🔄 Attempting to reconnect...");
      setTimeout(() => startWhatsApp(), 3000);
    }
  }
});



// Fungsi helper untuk menghapus folder auth
function deleteAuthFolder() {
  const authPath = path.join(process.cwd(), "auth");
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log("🗑️ Auth folder deleted successfully");
  }
}

// ---------- API ENDPOINTS ----------

// Health Check
app.get("/status", (req, res) => {
  res.json({
    connected: waReady,
    whatsapp_status: waReady ? "READY" : "NOT CONNECTED",
    timestamp: new Date().toISOString()
  });
});

// Send message endpoint
app.post("/send-message", async (req, res) => {
  if (!waReady) {
    return res.status(503).json({
      success: false,
      error: "WhatsApp session is not connected."
    });
  }

  const { number, message } = req.body;

  // Validate required fields
  if (!number || !message) {
    return res.status(400).json({
      success: false,
      error: "Both `number` and `message` fields are required."
    });
  }

  // Ensure number contains only digits
  if (!/^\d+$/.test(number)) {
    return res.status(400).json({
      success: false,
      error: "Phone number must contain only digits (0-9). No +, -, spaces, or symbols."
    });
  }

  try {
    const jid = `${number}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });

    res.json({
      success: true,
      message: "Message successfully sent.",
      to: number,
      text: message
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err?.message || "Unknown error occurred while sending message."
    });
  }
});

// Start
startWhatsApp();
app.listen(3000, () => console.log("🌍 WhatsApp API running on port 3000"));
