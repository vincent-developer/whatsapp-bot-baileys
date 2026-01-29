# WhatsApp Bot API with Document Converter

**(Baileys + Express + Bearer Token + DOCX Generator)**

A WhatsApp bot that provides REST API for sending messages and an interactive chat feature to convert text messages into Word documents (.docx).

---

## 🚀 Features

* **QR-based WhatsApp authentication**
* **Persistent session** using Baileys multi-file auth
* **Auto-reconnect** on disconnect (except logged-out cases)
* **REST API** for sending WhatsApp text messages
* **Interactive Bot** - Convert text to Word documents via chat
* **Bearer Token authentication** for API endpoints
* **Configurable** port via `.env`
* Ready for **Docker & Docker Compose** deployment

---

## 📦 Requirements

* **Node.js 18+**
* **npm**
* (Optional) **Docker & Docker Compose**

---

## 📁 Project Structure

```
whatsapp-bot/
├── src/
│   ├── handlers/
│   │   └── messageHandler.js
│   ├── services/
│   │   ├── docxGenerator.js
│   │   └── whatsappService.js
│   └── utils/
│       ├── constants.js
│       └── stateManager.js
├── temp/
├── auth_info_baileys/
├── node_modules/
├── server.js
├── package.json
├── docker-compose.yml
├── Dockerfile
├── .env
├── .env.example
└── .gitignore
```

---

## 🔐 Environment Variables

Create a `.env` file in the project root:

```env
PORT=3001
API_BEARER_TOKEN=your_secret_bearer_token_here
```

| Variable           | Required | Description                         |
| ------------------ | -------- | ----------------------------------- |
| `PORT`             | No       | Server port (default: 3001)         |
| `API_BEARER_TOKEN` | Yes      | Bearer token for API authentication |

**Generate a secure token:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🛠 Installation

```bash
# Install dependencies
npm install
```

---

## ▶️ Run the Server

### Local Development

```bash
node server.js
```

### Docker

```bash
docker-compose up -d
```

When the server starts, a **QR code** will appear in the terminal/logs.

**Scan via:**

📱 WhatsApp → **Linked Devices** → **Link a Device**

If successful:

```
✅ WhatsApp connected
```

---

## 💬 How to Use the Bot

### Interactive Text-to-Word Conversion

The bot listens to all incoming WhatsApp messages and provides an interactive way to convert text into Word documents.

#### 📋 Commands

| Command   | Description                              |
| --------- | ---------------------------------------- |
| `lcd`     | Start text-to-document conversion        |
| `cancel`  | Cancel current conversion process        |
| `help`    | Show help message with usage guide       |

> **Note:** Commands are case-insensitive (`lcd`, `LCD`, `Lcd` all work)

---

### 📝 Conversion Flow

#### Step 1: Start Conversion
Send `lcd` to the bot

```
You: lcd
```

#### Step 2: Bot Asks for Text
Bot replies asking you to send the text you want to convert

```
Bot: Silahkan ketik atau paste text yang ingin diconvert ke dokumen Word:
```

#### Step 3: Send Your Text
Send or paste the text you want to convert (supports multi-line text)

```
You: Judul Dokumen

Lorem Ipsum
lorem Lorem
```

#### Step 4: Receive Document
Bot processes and sends back a `.docx` file

```
Bot: Sedang memproses dokumen Anda... ⏳
Bot: 📄 [sends converted_document.docx]
Bot: Dokumen berhasil dibuat! 📄
```

---

### ✨ Features

* ✅ **Preserves line breaks** - Your text formatting is maintained
* ✅ **Multi-line support** - Send paragraphs, poems, lyrics, etc.
* ✅ **Auto-cleanup** - Temporary files are deleted after sending
* ✅ **Session timeout** - Process auto-cancels after 5 minutes of inactivity
* ✅ **Cancel anytime** - Type `cancel` to stop the process
* ✅ **Private only** - Bot only responds to direct messages (not groups)

---

### 🎯 Example Use Cases

**Poetry/Lyrics:**
```
You: lcd
Bot: Silahkan ketik...
You: [paste song lyrics]
Bot: [sends .docx file with formatted lyrics]
```

**Notes/Memo:**
```
You: lcd
Bot: Silahkan ketik...
You: Meeting notes:
- Discuss Q1 budget
- Review project timeline
- Team assignments
Bot: [sends .docx file]
```

**Long Text:**
```
You: lcd
Bot: Silahkan ketik...
You: [paste essay or article]
Bot: [sends .docx file]
```

---

## 📡 API Endpoints

### 🏥 GET `/status`

Health check endpoint to verify WhatsApp connection status.

**Response:**

```json
{
  "connected": true,
  "whatsapp_status": "READY",
  "timestamp": "2026-01-29T12:00:00.000Z"
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

```bash
curl -X POST http://localhost:3001/send-message \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"number":"6281234567890","message":"Hello from API!"}'
```

**Success Response:**

```json
{
  "success": true,
  "to": "6281234567890",
  "text": "Hello from API!"
}
```

---

## ⚠️ Error Handling

### API Errors

| Scenario               | Status Code | Message                                  |
| ---------------------- | ----------- | ---------------------------------------- |
| Missing token          | 401         | `Access denied. No token provided.`      |
| Invalid token          | 403         | `Invalid token.`                         |
| WhatsApp not connected | 503         | `WhatsApp session is not connected.`     |
| Missing payload fields | 400         | `number and message are required.`       |
| Invalid phone number   | 400         | `Phone number must contain digits only.` |
| Message send failure   | 500         | `Failed to send message.`                |

### Bot Errors

If document generation fails, the bot will reply:
```
Bot: Maaf, terjadi kesalahan. Silahkan coba lagi.
```

---

## 🔄 Session Management

WhatsApp authentication data is stored in:

```
auth_info_baileys/
```

### Reset Session (If Fully Logged Out)

**Docker:**
```bash
rm -rf auth_info_baileys
docker-compose restart
```

**Local:**
```bash
rm -rf auth_info_baileys
node server.js
```

Then scan the QR code again.

---

## 🧪 Testing

### Test API Endpoints

```bash
# Test status
curl http://localhost:3001/status

# Test send message
curl -X POST http://localhost:3001/send-message \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"number":"6281234567890","message":"Test message"}'
```

### Test Interactive Bot

1. Send `lcd` to the bot's WhatsApp number
2. Bot will reply asking for text
3. Send any text (try multi-line text)
4. Receive .docx file
5. Open the file in Microsoft Word or compatible app

---

## 📝 Notes

* Do **not** commit the `.env` file
* Do **not** commit `auth_info_baileys/` folder
* This is **not** an official WhatsApp API
* Temporary .docx files are auto-deleted after sending
* Bot only responds to direct messages (not groups)
* Session timeout: 5 minutes of inactivity

---

## 🔒 Security Recommendations

* Use strong Bearer tokens (32+ characters)
* Regularly update dependencies
* Monitor logs for suspicious activity

---

## 📄 License

MIT License — free for personal or commercial use.

---