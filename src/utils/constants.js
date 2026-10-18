export const COMMANDS = {
  CONVERT: 'lcd',
  SCRIBD: 'scribd',
  CANCEL: 'cancel',
  HELP: 'help'
};

export const USER_STATE = {
  IDLE: 'IDLE',
  WAITING_FOR_TEXT: 'WAITING_FOR_TEXT',
  WAITING_FOR_SCRIBD_URL: 'WAITING_FOR_SCRIBD_URL'
};

export const MESSAGES = {
  WELCOME: 'Halo! Ketik *lcd* untuk Word, atau *scribd* untuk unduh PDF dari Scribd.',
  ASK_TEXT: 'Silahkan ketik atau paste text yang ingin diconvert ke dokumen Word:',
  ASK_SCRIBD_URL: 'Kirim link Scribd dokumen yang ingin diunduh (contoh: https://www.scribd.com/document/123456789/Judul):',
  INVALID_SCRIBD_URL: 'Link tidak valid. Kirim URL Scribd berformat /document/... atau /doc/..., atau ketik *cancel* untuk batal.',
  PROCESSING: 'Sedang memproses dokumen Anda... ⏳',
  PROCESSING_SCRIBD: 'Sedang mengunduh dokumen Scribd... Ini bisa memakan waktu. ⏳',
  SUCCESS: 'Dokumen berhasil dibuat! 📄',
  SUCCESS_SCRIBD: 'Dokumen Scribd berhasil diunduh! 📄',
  ERROR: 'Maaf, terjadi kesalahan. Silahkan coba lagi.',
  ERROR_SCRIBD: 'Gagal mengunduh dokumen Scribd. Pastikan link bisa dibuka dan coba lagi.',
  CANCELLED: 'Proses dibatalkan.',
  HELP: `*Panduan Penggunaan:*

*lcd* — ubah text menjadi dokumen Word
1. Ketik *lcd*
2. Kirim text yang ingin diconvert
3. Terima file .docx

*scribd* — unduh dokumen Scribd sebagai PDF
1. Ketik *scribd*
2. Kirim link dokumen Scribd
3. Terima file .pdf

Ketik *cancel* untuk membatalkan proses.`
};
