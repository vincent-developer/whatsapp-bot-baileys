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
  WELCOME: `Selamat datang di *WA System VKKProgramming* 👋

Saya asisten untuk cek informasi Purchase Order.

Ketik:
• *po* — cek status / detail PO
• *help* — panduan singkat
• *cancel* — batalkan proses berjalan`,

  ASK_PO_NUMBER: `Baik. Silakan kirim *nomor PO* yang ingin dicek.
Contoh: 4500012345`,

  PO_NOT_FOUND: `Nomor PO tidak ditemukan di sistem. Mohon periksa kembali, atau ketik *po* untuk mencoba lagi.`,

  PO_INVALID: `Format nomor PO belum sesuai. Kirim angka saja, tanpa spasi atau simbol.
Contoh: 4500012345`,

  ASK_CHALLENGE: (maskedVendorName) =>
    `PO ditemukan atas nama vendor *${maskedVendorName}*.

Untuk keamanan data, mohon verifikasi identitas Anda.
Balas dengan *nomor HP* atau *email* yang terdaftar pada vendor tersebut.`,

  CHALLENGE_FAILED: `Verifikasi belum berhasil. Pastikan nomor HP atau email sesuai data terdaftar, lalu kirim ulang.`,

  CHALLENGE_UNAVAILABLE: `Kontak vendor untuk PO ini belum tersedia di sistem. Silakan hubungi administrator.`,

  VERIFIED: `Verifikasi berhasil. Berikut informasi PO Anda:`,

  ERROR: `Maaf, sistem sedang mengalami gangguan sementara. Silakan coba beberapa saat lagi.`,

  CANCELLED: `Baik, proses dibatalkan. Ketik *po* jika ingin mulai lagi.`,

  HELP: `*Panduan WA System VKKProgramming*

1. Ketik *po*
2. Kirim nomor PO
3. Verifikasi dengan HP atau email vendor
4. Terima detail PO

Perintah lain:
• *cancel* — batalkan proses
• *help* — tampilkan panduan ini`
};
