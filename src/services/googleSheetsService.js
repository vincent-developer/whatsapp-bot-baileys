import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/** Defaults from project setup (overridable via env) */
const DEFAULT_SPREADSHEET_ID = "1xMNjbpQJhh8jTOaNlxPWy9B2nTEMBAURR9Ys3O90jlM";
const DEFAULT_SHEET_TAB_NAME = "Jadwal Pasdior";
const DEFAULT_CREDENTIALS_REL = path.join(".secrets", "google_credential.json");

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Real sheet layout (tab "Jadwal Pasdior"):
 * Row 1: merged title in A
 * Row 2: A=Petugas Pasdior, B=Tanggal Misa, C=Waktu, D=Anamnese, E=Cara Tobat, F=Daftar Petugas Pasdior (merged)
 * Row 4: F=Koor Wilayah, G=Organis (subheaders)
 * Data from row 5 onward: A=Hari label, B=date, C=waktu, D/E optional, F=Koor, G=Organis.
 * If J is non-empty, effective Koor Wilayah = J (replaces F). If K is non-empty, effective Organis = K (replaces G).
 *
 * 0-based indices within each data row array (columns A–K):
 */
const COL = {
  HARI: 0, // A — Minggu / Sabtu / label
  TANGGAL_MISA: 1, // B
  WAKTU: 2, // C
  ANAMNESE: 3, // D
  CARA_TOBAT: 4, // E
  KOOR_WILAYAH: 5, // F — default Koor Wilayah
  ORGANIS: 6, // G — default Organis
  KOOR_OVERRIDE_J: 9, // J — if set, replaces Koor Wilayah for display & name search
  ORGANIS_OVERRIDE_K: 10, // K — if set, replaces Organis for display & name search
};

let cachedJwt = null;
let cachedDoc = null;
let loadedSpreadsheetId = null;
let rowCache = { expiresAt: 0, parsedRows: null };

function resolveCredentialsPath() {
  const envPath = process.env.GOOGLE_CREDENTIALS_PATH?.trim();
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.join(PROJECT_ROOT, envPath);
  }
  return path.join(PROJECT_ROOT, DEFAULT_CREDENTIALS_REL);
}

function loadServiceAccountFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const json = JSON.parse(raw);
  if (!json.client_email || !json.private_key) {
    throw new Error(
      "Service account JSON must contain client_email and private_key"
    );
  }
  return { email: json.client_email, key: json.private_key };
}

function buildJwt() {
  const credPath = resolveCredentialsPath();
  let email;
  let key;

  if (fs.existsSync(credPath)) {
    ({ email, key } = loadServiceAccountFromFile(credPath));
  } else {
    email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;
    key = rawKey ? rawKey.replace(/\\n/g, "\n") : null;
    if (!email || !key) {
      throw new Error(
        "Google Sheets auth not configured: add .secrets/google_credential.json or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY"
      );
    }
  }

  return new JWT({
    email,
    key,
    scopes: SCOPES,
  });
}

function getJwt() {
  if (!cachedJwt) cachedJwt = buildJwt();
  return cachedJwt;
}

function getSpreadsheetId() {
  return (
    process.env.GOOGLE_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID
  );
}

function getSheetTabName() {
  const t = process.env.GOOGLE_SHEET_TAB_NAME?.trim();
  return t || DEFAULT_SHEET_TAB_NAME;
}

async function getDocument() {
  const id = getSpreadsheetId();
  if (cachedDoc && loadedSpreadsheetId === id) {
    return cachedDoc;
  }
  const doc = new GoogleSpreadsheet(id, getJwt());
  await doc.loadInfo();
  cachedDoc = doc;
  loadedSpreadsheetId = id;
  return doc;
}

async function getWorksheet() {
  const doc = await getDocument();
  const title = getSheetTabName();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    const names = Object.keys(doc.sheetsByTitle || {}).join(", ");
    throw new Error(
      `Worksheet "${title}" not found. Available sheets: ${names || "(none)"}`
    );
  }
  return sheet;
}

function padCell(row, index) {
  if (!row || index < 0) return "";
  const v = row[index];
  if (v == null || v === "") return "";
  return String(v).trim();
}

function parseTanggalMisa(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d) {
  return startOfDay(d).getTime();
}

/** Sort by calendar date, then sheet row order. */
export function sortRowsChronological(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = dayKey(a.tanggal);
    const tb = dayKey(b.tanggal);
    if (ta !== tb) return ta - tb;
    return (a.rowNumber || 0) - (b.rowNumber || 0);
  });
}

/**
 * Parse one grid row (columns A–K) into a schedule object if column B is a valid date.
 */
function gridRowToSchedule(row, sheetRowNumber) {
  const tanggalRaw = padCell(row, COL.TANGGAL_MISA);
  const tanggal = parseTanggalMisa(tanggalRaw);
  if (!tanggal) return null;

  const hari = padCell(row, COL.HARI);
  const waktu = padCell(row, COL.WAKTU);
  const anamnese = padCell(row, COL.ANAMNESE);
  const caraTobat = padCell(row, COL.CARA_TOBAT);
  let koorWilayah = padCell(row, COL.KOOR_WILAYAH);
  let organis = padCell(row, COL.ORGANIS);
  const koorJ = padCell(row, COL.KOOR_OVERRIDE_J);
  const orgK = padCell(row, COL.ORGANIS_OVERRIDE_K);
  if (koorJ) koorWilayah = koorJ;
  if (orgK) organis = orgK;

  const extra = {};
  if (anamnese) extra.Anamnese = anamnese;
  if (caraTobat) extra["Cara Tobat"] = caraTobat;

  return {
    tanggal,
    tanggalRaw,
    hari,
    waktu,
    koorWilayah,
    organis,
    extra,
    rowNumber: sheetRowNumber,
  };
}

function containsInsensitive(haystack, needle) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

async function fetchParsedRows() {
  const now = Date.now();
  if (rowCache.parsedRows && now < rowCache.expiresAt) {
    return rowCache.parsedRows;
  }

  const sheet = await getWorksheet();
  const lastRow = Math.max(2, Math.min(sheet.rowCount || 10000, 10000));
  const grid = await sheet.getCellsInRange(`A2:K${lastRow}`);
  const parsedRows = [];

  for (let i = 0; i < grid.length; i++) {
    const row = grid[i] || [];
    const sheetRowNumber = i + 2;
    const sched = gridRowToSchedule(row, sheetRowNumber);
    if (sched) parsedRows.push(sched);
  }

  rowCache = {
    parsedRows,
    expiresAt: now + CACHE_TTL_MS,
  };
  return parsedRows;
}

/**
 * Diagnostic: tab name + raw A1:G12 grid (matches real merged-header layout).
 */
export async function dumpSheetStructure() {
  const sheet = await getWorksheet();
  const preview = await sheet.getCellsInRange("A1:K12");
  return {
    tabName: sheet.title,
    layoutNote:
      "Row 1 title in A; row 2 labels; row 4 Koor Wilayah/Organis; data from row 5 (A=Hari, B=Tanggal Misa, C=Waktu, F/G defaults; J/K override Koor/Organis when filled).",
    previewA1_G12: preview,
  };
}

/**
 * All upcoming rows (tanggal >= today), sorted chronologically.
 */
export async function getUpcomingChronological() {
  try {
    const rows = await fetchParsedRows();
    const today0 = startOfDay(new Date());
    const upcoming = rows.filter((r) => startOfDay(r.tanggal) >= today0);
    const sorted = sortRowsChronological(upcoming);
    return { ok: true, rows: sorted };
  } catch (e) {
    console.error("getUpcomingChronological:", e);
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}

/**
 * All schedule rows for the nearest calendar date >= today (all Masses that day).
 */
export async function getNearestSchedule() {
  try {
    const rows = await fetchParsedRows();
    const today0 = startOfDay(new Date());
    const upcoming = rows.filter((r) => startOfDay(r.tanggal) >= today0);
    if (!upcoming.length) {
      return { ok: true, rows: [] };
    }
    let minKey = Infinity;
    for (const r of upcoming) {
      const k = dayKey(r.tanggal);
      if (k < minKey) minKey = k;
    }
    const sameDay = upcoming.filter((r) => dayKey(r.tanggal) === minKey);
    sameDay.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));
    return { ok: true, rows: sameDay };
  } catch (e) {
    console.error("getNearestSchedule:", e);
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}

/**
 * All schedule rows on the nearest date >= today where the name matches
 * Koor Wilayah or Organis (case-insensitive substring).
 */
export async function getNearestScheduleByPerson(name) {
  try {
    const rows = await fetchParsedRows();
    const today0 = startOfDay(new Date());
    const matched = rows.filter(
      (r) =>
        startOfDay(r.tanggal) >= today0 &&
        (containsInsensitive(r.koorWilayah, name) ||
          containsInsensitive(r.organis, name))
    );
    if (!matched.length) {
      return { ok: true, rows: [] };
    }
    let minKey = Infinity;
    for (const r of matched) {
      const k = dayKey(r.tanggal);
      if (k < minKey) minKey = k;
    }
    const sameDay = matched.filter((r) => dayKey(r.tanggal) === minKey);
    sameDay.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));
    return { ok: true, rows: sameDay };
  } catch (e) {
    console.error("getNearestScheduleByPerson:", e);
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}

/**
 * All upcoming rows for which `name` matches Koor Wilayah or Organis (substring, case-insensitive),
 * sorted chronologically — same basis as `formatJadwalNearestAndNext` for person queries.
 */
export async function getUpcomingChronologicalByPerson(name) {
  try {
    const rows = await fetchParsedRows();
    const today0 = startOfDay(new Date());
    const matched = rows.filter(
      (r) =>
        startOfDay(r.tanggal) >= today0 &&
        (containsInsensitive(r.koorWilayah, name) ||
          containsInsensitive(r.organis, name))
    );
    const sorted = sortRowsChronological(matched);
    return { ok: true, rows: sorted };
  } catch (e) {
    console.error("getUpcomingChronologicalByPerson:", e);
    return { ok: false, rows: [], error: e.message || String(e) };
  }
}

/** Plain multi-line block for one schedule row (no WhatsApp bold). */
export function formatScheduleDetailPlain(r) {
  if (!r) return "";
  const lines = [];
  if (r.hari) lines.push(`Hari: ${r.hari}`);
  lines.push(`Tanggal Misa: ${r.tanggalRaw || "—"}`);
  if (r.waktu) lines.push(`Waktu: ${r.waktu}`);
  for (const [k, v] of Object.entries(r.extra || {})) {
    if (v) lines.push(`${k}: ${v}`);
  }
  if (r.koorWilayah) lines.push(`Koor Wilayah: ${r.koorWilayah}`);
  if (r.organis) lines.push(`Organis: ${r.organis}`);
  return lines.join("\n");
}

/** One-line summary: "Minggu, 10-May-2026 18.00 - Koor - Organis" */
export function formatScheduleCompactLine(r) {
  if (!r) return "";
  const dateTime = [r.tanggalRaw, r.waktu].filter(Boolean).join(" ");
  const left = r.hari ? `${r.hari}, ${dateTime}`.trim() : dateTime;
  const koor = r.koorWilayah || "—";
  const org = r.organis || "—";
  return `${left} - ${koor} - ${org}`;
}

/**
 * `jadwal` reply: first upcoming task (detail) + up to 2 following tasks (compact).
 * `sortedRows` must be chronological (e.g. from getUpcomingChronological).
 */
export function formatJadwalNearestAndNext(sortedRows) {
  if (!sortedRows?.length) return "";
  const head = formatScheduleDetailPlain(sortedRows[0]);
  const tail = sortedRows.slice(1, 3);
  if (!tail.length) return head;
  const title =
    tail.length === 1 ? "1 tugas selanjutnya" : "2 tugas selanjutnya";
  return `${head}\n\n${title}\n${tail.map(formatScheduleCompactLine).join("\n")}`;
}

/**
 * Format one or more schedule rows (plain text; multiple rows separated by a blank line).
 */
export function formatScheduleMessage(rows, opts = {}) {
  const { intro } = opts;
  if (!rows?.length) return "";

  const blocks = rows.map((r) => formatScheduleDetailPlain(r));
  const body = blocks.join("\n\n");
  return intro ? `${intro}\n\n${body}` : body;
}
