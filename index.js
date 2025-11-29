const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

const TARGET_NUMBER = "6281384362548@s.whatsapp.net"; // <-- change this
const MESSAGE_TEXT = "Hello from Baileys & Docker 🚀";  // <-- change message

let messageSent = false; // ensure only 1 send

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      console.log("\n📌 Scan the QR with WhatsApp:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Connected to WhatsApp!");

      // ---- SEND MESSAGE ONCE ----
      if (!messageSent) {
        try {
          await sock.sendMessage(TARGET_NUMBER, { text: MESSAGE_TEXT });
          console.log(`📨 Message sent to ${TARGET_NUMBER}: "${MESSAGE_TEXT}"`);
          messageSent = true;
        } catch (err) {
          console.error("❌ Failed sending message:", err);
        }
      }
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("⚠ Reconnecting...");
        startSock();
      } else {
        console.log("❌ Logged out — delete auth folder to re-login");
      }
    }
  });
}

startSock().catch(console.error);
