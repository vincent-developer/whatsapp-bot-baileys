# WhatsApp Messaging API

**(Baileys + Express + Bearer Token)**

A simple REST API for sending WhatsApp messages using **@whiskeysockets/baileys**.
Supports QR-based login, persistent sessions, auto-reconnect, and API authentication via **Bearer Token**.

---

## 🚀 Features

* QR-based WhatsApp authentication
* Persistent session using Baileys multi-file auth
* Auto-reconnect on disconnect (except logged-out cases)
* REST API for sending WhatsApp text messages
* Bearer Token authentication
* Configurable port via `.env`
* Ready for Docker & Docker Compose deployment

---

## 📦 Requirements

* **Node.js 22+**
* **npm**
* (Optional) **Docker & Docker Compose**

---

## 📁 Project Structure (Simplified)

```
.
├── auth_info_baileys/   # Persistent WhatsApp session
├── server.js
├── Dockerfile
├── docker-compose.yml
├── .env
└── package.json
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
API_BEARER_TOKEN=your_secret_bearer_token
```

| Variable           | Required | Description                         |
| ------------------ | -------- | ----------------------------------- |
| `PORT`             | No       | Server port (default: 3000)         |
| `API_BEARER_TOKEN` | Yes      | Bearer token for API authentication |

---

## 🛠 Installation (Local)

Install dependencies:

```bash
npm install
```

---

## ▶️ Run the Server (Local)

```bash
node server.js
```

When the server starts, a QR code will appear in the terminal.

**Scan via:**

📱 WhatsApp → **Linked Devices** → **Link a Device**

If successful:

```
✅ WhatsApp connected
```

---

## 🐳 Run with Docker Compose (Recommended)

```bash
docker compose up -d
```

* Port follows the value in `.env`
* WhatsApp session is persisted in `auth_info_baileys/`
* No image rebuild required when changing `.env`

---

## 📡 API Endpoints

### 🏥 GET `/status`

Health check endpoint to verify WhatsApp connection status.

**Response:**

```json
{
  "connected": true,
  "whatsapp_status": "READY",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

---

### ✉️ POST `/send-message`

Send a WhatsApp text message (**Protected Endpoint**).

#### Required Headers

```
Authorization: Bearer <API_BEARER_TOKEN>
Content-Type: application/json
```

#### JSON Body

| Field     | Type   | Required | Description                                         |
| --------- | ------ | -------- | --------------------------------------------------- |
| `number`  | string | Yes      | WhatsApp number (digits only, e.g. `6281234567890`) |
| `message` | string | Yes      | Message content                                     |

**Example Request:**

```json
{
  "number": "6281234567890",
  "message": "Hello from the API!"
}
```

**Success Response:**

```json
{
  "success": true,
  "to": "6281234567890",
  "text": "Hello from the API!"
}
```

---

## ⚠️ Error Handling

| Scenario               | Status Code | Message                                  |
| ---------------------- | ----------- | ---------------------------------------- |
| Missing token          | 401         | `Access denied. No token provided.`      |
| Invalid token          | 403         | `Invalid token.`                         |
| WhatsApp not connected | 503         | `WhatsApp session is not connected.`     |
| Missing payload fields | 400         | `number and message are required.`       |
| Invalid phone number   | 400         | `Phone number must contain digits only.` |
| Message send failure   | 500         | `Failed to send message.`                |

---

## 🔄 Session Management

WhatsApp authentication data is stored in:

```
auth_info_baileys/
```

### Reset Session (If Fully Logged Out)

```bash
rm -rf auth_info_baileys
docker compose restart
```

Or (local):

```bash
node server.js
```

Then scan the QR code again.

---

## 🧪 Test via cURL

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Authorization: Bearer your_secret_bearer_token" \
  -H "Content-Type: application/json" \
  -d '{"number":"6281234567890","message":"Hello from the API!"}'
```

---

## 🧠 Notes

* Do **not** commit the `.env` file
* Do **not** hardcode secrets in source code
* Use a reverse proxy (Nginx) if you want to expose ports 80/443
* This is **not** an official WhatsApp API

---

## 📄 License

MIT License — free for personal or commercial use.

---