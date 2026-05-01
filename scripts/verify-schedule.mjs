/**
 * Smoke test for Google Sheets schedule (no WhatsApp).
 * Run: npm run verify-schedule
 */
import "dotenv/config";
import {
  dumpSheetStructure,
  getUpcomingChronological,
  getUpcomingChronologicalByPerson,
  formatJadwalNearestAndNext,
} from "../src/services/googleSheetsService.js";

async function main() {
  console.log("1) dumpSheetStructure (preview)...");
  const dump = await dumpSheetStructure();
  console.log("   tab:", dump.tabName);
  console.log("   note:", dump.layoutNote);

  console.log("\n2) getUpcomingChronological + formatJadwalNearestAndNext...");
  const upcoming = await getUpcomingChronological();
  if (!upcoming.ok) {
    console.error("   FAIL:", upcoming.error);
    process.exit(1);
  }
  console.log("   rows:", upcoming.rows.length);
  if (upcoming.rows.length) {
    console.log(formatJadwalNearestAndNext(upcoming.rows));
  }

  console.log("\n3) getUpcomingChronologicalByPerson('Vincent')...");
  const p = await getUpcomingChronologicalByPerson("Vincent");
  if (!p.ok) {
    console.error("   FAIL:", p.error);
    process.exit(1);
  }
  console.log("   rows:", p.rows.length);
  if (p.rows.length) console.log(formatJadwalNearestAndNext(p.rows));

  console.log("\nOK — schedule service reachable.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
