export const COMMANDS = {
  CONVERT: "lcd",
  SCHEDULE: "jadwal",
  CANCEL: "cancel",
  HELP: "help",
};

export const USER_STATE = {
  IDLE: "IDLE",
  WAITING_FOR_TEXT: "WAITING_FOR_TEXT",
  WAITING_FOR_SCHEDULE_QUERY: "WAITING_FOR_SCHEDULE_QUERY",
};

/** Regex: capture group 1 = name (trimmed in handler) */
export const REGEX = {
  SCHEDULE_QUERY: /^(.+?)\s+tugas\s+kapan\s*\??\s*$/i,
};

export const MESSAGES = {
  WELCOME:
    "Halo! Ketik *lcd* untuk mengubah text menjadi dokumen Word, atau *jadwal* untuk cek jadwal tugas Pasdior.",
  ASK_TEXT: "Silahkan ketik atau paste text yang ingin diconvert ke dokumen Word:",
  PROCESSING: "Sedang memproses dokumen Anda... ⏳",
  SUCCESS: "Dokumen berhasil dibuat! 📄",
  ERROR: "Maaf, terjadi kesalahan. Silahkan coba lagi.",
  CANCELLED: "Proses dibatalkan.",
  HELP: `*Panduan Penggunaan:*

1. Ketik *lcd* untuk memulai konversi ke Word
2. Kirim text yang ingin diconvert
3. Terima file .docx

*Jadwal Pasdior*
1. Ketik *jadwal* untuk jadwal terdekat
2. Lalu ketik *nama tugas kapan?* untuk cek orang tertentu

Ketik *cancel* untuk membatalkan proses.`,
  SCHEDULE_FETCHING: "Mengambil jadwal dari Google Sheet... ⏳",
  SCHEDULE_HINT:
    "\n\nIngin tahu jadwal orang tertentu? Ketik nama tugas kapan?",
  SCHEDULE_NONE_UPCOMING:
    "Tidak ada jadwal misa yang tercatat mulai hari ini ke depan.",
  SCHEDULE_ERROR:
    "Maaf, gagal mengambil jadwal. Periksa koneksi atau izin Google Sheet, lalu coba lagi.",
  SCHEDULE_PERSON_NOT_FOUND:
    "Tidak ditemukan jadwal mendatang untuk {name} sebagai Koor Wilayah atau Organis.",
  SCHEDULE_QUERY_HINT:
    'Format: *nama tugas kapan?* (contoh: *Maureen tugas kapan?*) — atau ketik *cancel* untuk keluar.',
};
