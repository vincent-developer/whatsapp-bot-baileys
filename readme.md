# WhatsApp Messaging API (Baileys + Express)

This project provides a simple REST API to send WhatsApp messages using **@whiskeysockets/baileys**.  
The server supports QR login, persistent authentication, and message sending through HTTP calls.

---

## 🚀 Features

- QR-based WhatsApp authentication
- Persistent session using Baileys Multi-File Auth
- Auto-reconnect on disconnect (except logged-out cases)
- REST API for sending text messages
- Built-in error handling and validation

---

## 📦 Requirements

- **Node.js 22+**
- **npm**

---

## 🛠 Installation

Install dependencies:

```bash
npm install
```

---

## ▶️ Run the Server

Start the WhatsApp API server:

```bash
node server.js
```

After starting, a QR code will appear in the terminal.

**Scan it using:**

📱 **WhatsApp → Linked Devices → Link a Device**

Once connected, you will see:

```
🚀 WhatsApp Connected!
```

If the connection drops, the script will attempt to reconnect automatically.

If WhatsApp logs out the session entirely, you'll see:

```
❌ Session expired — delete `auth` folder and scan again.
```

---

## 📡 API Endpoints

### 🏥 GET `/status`
Checks the WhatsApp connection state.

**Example Response:**
```json
{
  "connected": true,
  "whatsapp_status": "READY",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### ✉️ POST `/send-message`
Sends a WhatsApp text message.

**Required JSON Payload:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `number` | string | Yes | Phone number in digit format (example: `6281234567890`) |
| `message` | string | Yes | Message content |

**Example Request:**
```json
{
  "number": "6281234567890",
  "message": "Hello from the API!"
}
```

**Example Success Response:**
```json
{
  "success": true,
  "message": "Message successfully sent.",
  "to": "6281234567890",
  "text": "Hello from the API!"
}
```

---

## ⚠️ Error Handling

The server includes detailed error responses:

| Error Scenario | Status Code | Response |
|----------------|-------------|----------|
| WhatsApp not connected | 503 | `"WhatsApp session is not connected."` |
| Missing fields (number or message) | 400 | `"Both 'number' and 'message' fields are required."` |
| Invalid phone number format | 400 | `"Phone number must contain only digits (0-9)."` |
| WhatsApp send failure | 500 | `"Unknown error occurred while sending message."` |

**Console Log Messages:**
- Connection closed unexpectedly: `"⚠ Connection closed: <reason>"`
- Session logged out: `"❌ Session expired — delete 'auth' folder and scan again."`

---

## 🔄 Session Management

The authentication session is stored inside the `auth/` folder.

**If you need to reset the session:**

```bash
rm -rf auth
node server.js
```

Then scan a new QR code.

---

## 🧪 Test via cURL

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{"number":"6281234567890","message":"Hello from the API!"}'
```

---

## 📄 License

MIT License — free for personal or commercial use.