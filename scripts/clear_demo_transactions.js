const fs = require("fs");
const path = require("path");

const CWD = process.cwd();
const jiti = require("jiti")(path.join(CWD, "index.js"));

const { SCHEMA } = jiti("./src/lib/schema.ts");
const { getGoogleClients, getActiveSheetsId } = jiti("./src/lib/google.ts");

const TRANSACTION_TABLES = [
  "SUBMISSIONS",
  "SUBMISSION_DOCUMENTS",
  "SUBMISSION_PHOTOS",
  "SUBMISSION_REVISION_HISTORY",
  "SUBMISSION_STATUS_HISTORY",
  "REGIONAL_POOLINGS",
  "REGIONAL_POOLING_ITEMS",
  "REGIONAL_MEMOS",
  "MEMO_POOLING_ITEMS",
  "MEMO_FORWARDING",
  "ACTIVITY_LOGS",
  "AI_KNOWLEDGE_BASE",
];

async function main() {
  console.log("=== PEMBERSIHAN DATA TRANSAKSI DEMO UNTUK PERSIAPAN DEPLOYMENT ===");

  const dbPath = path.join(CWD, "data/db.json");
  if (!fs.existsSync(dbPath)) {
    throw new Error("File data/db.json tidak ditemukan!");
  }

  const db = JSON.parse(fs.readFileSync(dbPath, "utf8"));

  // 1. Bersihkan transaksi demo di database lokal
  console.log("\n[1/3] Membersihkan tabel transaksi di database lokal (db.json)...");
  for (const table of TRANSACTION_TABLES) {
    const prevCount = (db[table] || []).length;
    db[table] = [];
    console.log(` - ${table}: ${prevCount} baris dihapus -> 0 baris.`);
  }

  // 2. Pastikan TEMPLATES berstatus resmi (is_demo: "0")
  if (Array.isArray(db.TEMPLATES)) {
    db.TEMPLATES.forEach((t) => {
      t.is_demo = "0";
      if (t.updated_by && t.updated_by.includes("Demo")) {
        t.updated_by = "Admin PAM Pusat";
      }
    });
    console.log(" - TEMPLATES: semua template diset resmi (is_demo: '0').");
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  console.log("Database lokal (db.json) berhasil diperbarui.");

  // 3. Bersihkan transaksi demo di Google Spreadsheet
  const sheetsId = getActiveSheetsId();
  console.log(`\n[2/3] Menghubungkan ke Google Sheets ID: ${sheetsId}...`);
  const { sheets } = getGoogleClients();

  for (const table of TRANSACTION_TABLES) {
    process.stdout.write(` - Mengosongkan tab ${table}... `);
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetsId,
        range: `${table}!A2:Z2000`,
      });
      console.log("OK (Bersih)");
    } catch (err) {
      console.log(`GAGAL (${err.message})`);
    }
  }

  // Perbarui TEMPLATES di Google Sheets agar is_demo = "0"
  console.log(" - Memperbarui status resmi tab TEMPLATES di Sheets...");
  if (Array.isArray(db.TEMPLATES) && db.TEMPLATES.length > 0) {
    const templateHeader = SCHEMA.TEMPLATES;
    const templateValues = db.TEMPLATES.map((r) => templateHeader.map((c) => r[c] || ""));
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: "TEMPLATES!A2",
      valueInputOption: "RAW",
      requestBody: { values: templateValues },
    });
  }

  // 4. Verifikasi Keutuhan Data
  console.log("\n[3/3] Verifikasi Hasil Pembersihan...");
  const verifySubmissions = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "SUBMISSIONS!A2:C5",
  });
  const subRows = verifySubmissions.data.values || [];
  console.log(` - Sisa pengajuan di SUBMISSIONS: ${subRows.length} (Target: 0)`);

  const verifyUsers = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "USERS!A2:B10",
  });
  const userRows = verifyUsers.data.values || [];
  console.log(` - Master USERS di Sheets: Tersedia (${userRows.length > 0 ? "Utuh" : "Kosong"})`);

  const verifySpbus = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "SPBUS!A2:B10",
  });
  const spbuRows = verifySpbus.data.values || [];
  console.log(` - Master SPBUS di Sheets: Tersedia (${spbuRows.length > 0 ? "Utuh" : "Kosong"})`);

  console.log("\n=== PEMBERSIHAN SELESAI DENGAN SUKSES! APLIKASI KINI BERSIH (FRESH STATE) SIAP GO-LIVE! ===");
}

main().catch((err) => {
  console.error("Gagal membersihkan data:", err);
  process.exit(1);
});
