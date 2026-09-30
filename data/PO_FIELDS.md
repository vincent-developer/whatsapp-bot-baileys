# PO Data Field Guide

This document explains the SAP-style field names used by the bot.

**Runtime data source:** Google Sheets (tabs `PO` and `VendorContacts`).  
Local JSON files under `data/` are reference samples only and are not read at runtime.

Field names follow classic SAP MM Purchasing (`EKKO` and related tables).
They are common in ECC 6 and largely carried over to S/4HANA.
This is application-level ERP vocabulary, not HANA-specific.

## Header fields (sheet tab: `PO`)

| Field | SAP meaning | Example | Notes |
|-------|-------------|---------|-------|
| `EBELN` | Purchasing Document Number (PO number) | `4500012345` | Primary lookup key |
| `BSART` | Purchasing Document Type | `NB`, `UB` | `NB` = standard PO; `UB` = stock transport |
| `BUKRS` | Company Code | `1000` | Legal entity in SAP |
| `LIFNR` | Vendor Account Number | `0000123456` | Often zero-padded; also used for challenge mapping |
| `NAME1` | Vendor Name | `PT MAJU JAYA` | From vendor master (`LFA1`), joined for display |
| `EKORG` | Purchasing Organization | `1000` | Org responsible for procurement |
| `EKGRP` | Purchasing Group | `P01` | Buyer / purchasing team |
| `BEDAT` | Purchasing Document Date | `20260915` | Format `YYYYMMDD` |
| `FRGKE` | Release Indicator | `R` or empty | `R` = released; empty = not released |
| `WAERS` | Currency Key | `IDR`, `USD` | ISO currency |
| `RLWRT` | Total value at release | `12500000.00` | Net/release value as decimal string |
| `EINDT` | Item Delivery Date | `20261005` | Format `YYYYMMDD` (typically from `EKET`) |

Format ID-like columns (`EBELN`, `LIFNR`, `BEDAT`, `EINDT`, phones) as **Plain text** in Google Sheets so leading zeros are preserved.

## How the bot uses these fields

1. User sends a PO number after typing `po`.
2. `poService` looks up `EBELN` from Google Sheet tab `PO`.
3. Bot challenges the user with a masked vendor name (`NAME1`).
4. User must send the registered phone **or** email for that vendor (`LIFNR`) from tab `VendorContacts`.
5. On success, fields are mapped to a friendly WhatsApp message
   (e.g. `FRGKE=R` → `Released`, dates formatted for humans).
6. Challenge is required on **every** PO request (no trusted session).

## Vendor contacts (sheet tab: `VendorContacts`)

Mapping used for the verification challenge. Keyed by `LIFNR`.

| Field | Meaning | Example |
|-------|---------|---------|
| `LIFNR` | Vendor account number | `0000123456` |
| `NAME1` | Vendor name (source for masking) | `PT MAJU JAYA` |
| `phone` | Registered phone (digits, country code) | `628111000001` |
| `email` | Registered email | `contact@majujaya.example` |

Masked name example: `PT MAJU JAYA` → `PT M*** J***`.

### Test credentials

| LIFNR | Vendor | Phone | Email |
|-------|--------|-------|-------|
| `0000123456` | PT MAJU JAYA | `628111000001` | `contact@majujaya.example` |
| `0000789012` | CV SUMBER MAKMUR | `628111000002` | `info@sumbermakmur.example` |
| `0000345678` | PT TEKNOLOGI NUSANTARA | `628111000003` | `po@teknusantara.example` |

## Google Sheets setup

1. Create one spreadsheet with two tabs named exactly `PO` and `VendorContacts`.
2. Row 1 = headers (exact names above).
3. Share the spreadsheet as **Anyone with the link** (Viewer).
4. Set `GOOGLE_SHEETS_SPREADSHEET_ID` in `.env`.

No Google Cloud service account is required for this POC. Data is read via public CSV export.

## Adding a new sample PO

1. Add a row in sheet tab `PO` (same columns; no nested line items).
2. Ensure `LIFNR` exists in sheet tab `VendorContacts` with phone + email.
3. No restart required — data is fetched per request.

## Sample PO numbers for testing

| EBELN | LIFNR | Notes |
|-------|-------|-------|
| `4500012345` | `0000123456` | Released, IDR |
| `4500012346` | `0000789012` | Not released, IDR |
| `4500012347` | `0000345678` | Released, USD |
