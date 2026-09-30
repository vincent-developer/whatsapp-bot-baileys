# WhatsApp Bot — SAP PO Lookup POC

**(Baileys + Express + Bearer Token + Google Sheets)**

POC bot WhatsApp untuk cek data Purchase Order. Data source: Google Sheets (field bergaya SAP); balasan ke user di-mapping jadi pesan yang rapi. Setiap request PO wajib lolos challenge vendor (HP atau email).

---

## Features

* QR-based WhatsApp authentication
* Persistent session (Baileys multi-file auth)
* Auto-reconnect on disconnect
* Interactive bot: cek PO via chat (`po`) dengan vendor challenge
* Data from public Google Sheets (`PO` + `VendorContacts` tabs)
* REST API untuk kirim pesan WhatsApp
* Bearer Token authentication

---

## Requirements

* Node.js 18+
* npm
* Public Google Spreadsheet (Anyone with the link → Viewer)

---

## Project Structure

```
whatsapp-bot/
├── data/
│   ├── po.json                  # Reference sample only (not used at runtime)
│   ├── vendor_contacts.json     # Reference sample only (not used at runtime)
│   └── PO_FIELDS.md             # Field + Sheets guide
├── src/
│   ├── handlers/
│   │   └── messageHandler.js
│   ├── services/
│   │   ├── googleSheetsClient.js
│   │   ├── poService.js
│   │   ├── vendorAuthService.js
│   │   └── whatsappService.js
│   └── utils/
│       ├── constants.js
│       └── stateManager.js
├── auth_info_baileys/
├── server.js
├── package.json
├── .env
└── .env.example
```

---

## Environment Variables

```env
PORT=3000
API_BEARER_TOKEN=your_secret_bearer_token_here
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
```

---

## Google Sheets Setup

1. Create **one** spreadsheet with two tabs named exactly:
   - `PO`
   - `VendorContacts`
2. Put headers on row 1 (see `data/PO_FIELDS.md` for columns + sample rows).
3. Format ID/phone columns as **Plain text** (preserve leading zeros).
4. Share: **Anyone with the link** → **Viewer**.
5. Copy spreadsheet ID from the URL into `.env` (`GOOGLE_SHEETS_SPREADSHEET_ID`).

---

## Installation & Run

```bash
npm install
npm start
```

Scan QR via WhatsApp → Linked Devices → Link a Device.

---

## Bot Commands

| Command  | Description                |
| -------- | -------------------------- |
| `po`     | Mulai cek Purchase Order   |
| `cancel` | Batalkan proses            |
| `help`   | Tampilkan panduan          |

### Flow

```
You: halo
Bot: Selamat datang di WA System VKKProgramming ...
You: po
Bot: Baik. Silakan kirim nomor PO yang ingin dicek.
You: 4500012345
Bot: PO ditemukan atas nama vendor PT M*** J***
     Mohon verifikasi dengan HP atau email terdaftar...
You: 628111000001
Bot: Verifikasi berhasil. Berikut informasi PO Anda:
     [detail PO friendly]
```

Challenge wajib setiap kali minta PO. Retry bebas jika salah; ketik `cancel` untuk batal.

Sample PO / credentials: lihat `data/PO_FIELDS.md`.

---

## API Endpoints

### GET `/status`

```bash
curl http://localhost:3000/status
```

### POST `/send-message`

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Authorization: Bearer your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"number":"6281234567890","message":"Hello from API!"}'
```

---

## Session Reset

```bash
rm -rf auth_info_baileys
npm start
```

---

## Notes

* Jangan commit `.env` atau `auth_info_baileys/`
* Bukan official WhatsApp API
* Bot hanya merespons chat pribadi (bukan group)
* Session timeout: 5 menit
* Sheets di-fetch per request via public CSV export (no service account)

---

## License

MIT
