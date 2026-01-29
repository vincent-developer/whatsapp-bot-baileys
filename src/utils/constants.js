export const COMMANDS = {
  CONVERT: 'lcd',
  CANCEL: 'cancel',
  HELP: 'help'
};

export const USER_STATE = {
  IDLE: 'IDLE',
  WAITING_FOR_TEXT: 'WAITING_FOR_TEXT'
};

export const MESSAGES = {
  WELCOME: 'Halo! Ketik *lcd* untuk mengubah text menjadi dokumen Word.',  // <- update juga
  ASK_TEXT: 'Silahkan ketik atau paste text yang ingin diconvert ke dokumen Word:',
  PROCESSING: 'Sedang memproses dokumen Anda... ⏳',
  SUCCESS: 'Dokumen berhasil dibuat! 📄',
  ERROR: 'Maaf, terjadi kesalahan. Silahkan coba lagi.',
  CANCELLED: 'Proses dibatalkan.',
  HELP: `*Panduan Penggunaan:*
  
1. Ketik *lcd* untuk memulai
2. Kirim text yang ingin diconvert
3. Terima file .docx

Ketik *cancel* untuk membatalkan proses.`  // <- update juga
};