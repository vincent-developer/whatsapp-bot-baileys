import { fetchSheetRows } from "./googleSheetsClient.js";

async function loadVendorContacts() {
  return fetchSheetRows("VendorContacts");
}

/**
 * Lookup vendor contact by LIFNR
 */
export async function getByLifnr(lifnr) {
  const normalized = String(lifnr || "").trim();
  if (!normalized) return null;

  const records = await loadVendorContacts();
  return records.find((vendor) => vendor.LIFNR === normalized) || null;
}

/**
 * Mask vendor name: keep first letter of each word, mask the rest.
 * Example: "PT MAJU JAYA" → "PT M*** J***"
 */
export function maskVendorName(name) {
  if (!name) return "***";

  return String(name)
    .split(/\s+/)
    .map((word) => {
      // Keep short legal forms (PT, CV, UD, etc.) unmasked
      if (word.length <= 2) return word;
      return `${word[0]}${"*".repeat(word.length - 1)}`;
    })
    .join(" ");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Verify input against vendor phone OR email for the given LIFNR.
 */
export async function verifyContact(lifnr, input) {
  const vendor = await getByLifnr(lifnr);
  if (!vendor) return false;

  const raw = String(input || "").trim();
  if (!raw) return false;

  if (raw.includes("@")) {
    return normalizeEmail(raw) === normalizeEmail(vendor.email);
  }

  const inputPhone = normalizePhone(raw);
  if (!inputPhone) return false;

  return inputPhone === normalizePhone(vendor.phone);
}
