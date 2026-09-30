export const COMMANDS = {
  PO: 'po',
  CANCEL: 'cancel',
  HELP: 'help'
};

export const USER_STATE = {
  IDLE: 'IDLE',
  WAITING_FOR_PO: 'WAITING_FOR_PO',
  WAITING_FOR_CHALLENGE: 'WAITING_FOR_CHALLENGE'
};

export const MESSAGES = {
  WELCOME: 'Halo! Ketik *po* untuk cek Purchase Order.',
  ASK_PO_NUMBER: 'Silahkan masukkan nomor PO:',
  PO_NOT_FOUND: 'PO tidak ditemukan. Periksa nomor PO lalu coba lagi.',
  PO_INVALID: 'Nomor PO harus berupa angka. Silahkan kirim ulang nomor PO:',
  ASK_CHALLENGE: (maskedVendorName) =>
    `Untuk melihat detail PO, verifikasi dulu sebagai vendor *${maskedVendorName}*.\n\nKirim nomor HP atau email yang terdaftar:`,
  CHALLENGE_FAILED: 'Verifikasi gagal. Kirim ulang nomor HP atau email yang terdaftar:',
  CHALLENGE_UNAVAILABLE: 'Kontak vendor untuk PO ini belum terdaftar. Tidak dapat menampilkan detail.',
  ERROR: 'Maaf, terjadi kesalahan saat mengambil data. Silahkan coba lagi.',
  CANCELLED: 'Proses dibatalkan.',
  HELP: `*Panduan Penggunaan:*

1. Ketik *po*
2. Kirim nomor PO
3. Verifikasi dengan nomor HP atau email vendor
4. Terima detail PO

Ketik *cancel* untuk membatalkan proses.`
};
