import { parse } from "csv-parse/sync";

const SHEET_TABS = {
  PO: "PO",
  VendorContacts: "VendorContacts"
};

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id || id === "your_spreadsheet_id") {
    throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is missing in .env");
  }
  return id;
}

function buildCsvUrl(sheetName) {
  const spreadsheetId = getSpreadsheetId();
  const params = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName
  });
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;
}

/**
 * Fetch a public sheet tab via CSV export and return rows as objects.
 * Spreadsheet must be shared as "Anyone with the link" (Viewer).
 */
export async function fetchSheetRows(sheetName) {
  const tabName = SHEET_TABS[sheetName];
  if (!tabName) {
    throw new Error(`Unknown sheet tab: ${sheetName}`);
  }

  const url = buildCsvUrl(tabName);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sheet "${tabName}": HTTP ${response.status}`);
  }

  const csvText = await response.text();

  // Google sometimes returns an HTML login/error page instead of CSV
  if (csvText.trim().startsWith("<!DOCTYPE") || csvText.trim().startsWith("<html")) {
    throw new Error(
      `Sheet "${tabName}" is not publicly readable. Share it as "Anyone with the link" (Viewer).`
    );
  }

  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });

  return records.map((row) => {
    const record = {};
    for (const [key, value] of Object.entries(row)) {
      const header = String(key || "").trim();
      if (!header) continue;
      record[header] = value === undefined || value === null ? "" : String(value).trim();
    }
    return record;
  });
}
