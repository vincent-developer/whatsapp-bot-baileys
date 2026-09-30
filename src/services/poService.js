import { fetchSheetRows } from "./googleSheetsClient.js";

async function loadPoData() {
  return fetchSheetRows("PO");
}

/**
 * Lookup PO by EBELN (exact match after trim)
 */
export async function getByNumber(poNumber) {
  const normalized = String(poNumber || "").trim();
  if (!normalized) return null;

  const records = await loadPoData();
  return records.find((po) => po.EBELN === normalized) || null;
}

function formatSapDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || "-";

  const year = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  const monthLabel = months[Number(month) - 1] || month;

  return `${Number(day)} ${monthLabel} ${year}`;
}

function formatAmount(value, currency) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return `${value} ${currency || ""}`.trim();

  if (currency === "IDR") {
    return `Rp ${amount.toLocaleString("id-ID")}`;
  }

  return `${currency || ""} ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`.trim();
}

function mapReleaseStatus(frgke) {
  return frgke === "R" ? "Released" : "Not Released";
}

/**
 * Map SAP-like PO fields into a friendly WhatsApp message
 */
export function formatPoMessage(po) {
  return `*Purchase Order*

Nomor PO   : ${po.EBELN}
Tipe       : ${po.BSART}
Vendor     : ${po.NAME1} (${po.LIFNR})
Company    : ${po.BUKRS}
Purch. Org : ${po.EKORG} / ${po.EKGRP}
Status     : ${mapReleaseStatus(po.FRGKE)}
Nilai      : ${formatAmount(po.RLWRT, po.WAERS)}
Tgl PO     : ${formatSapDate(po.BEDAT)}
Delivery   : ${formatSapDate(po.EINDT)}`;
}
