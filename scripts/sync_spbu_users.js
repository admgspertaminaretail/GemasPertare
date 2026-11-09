const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const CWD = process.cwd();
const jiti = require("jiti")(path.join(CWD, "index.js"));

const { SCHEMA } = jiti("./src/lib/schema.ts");
const { getGoogleClients, getActiveSheetsId } = jiti("./src/lib/google.ts");

const ROMAN_TO_NUM = {
  I: "1",
  II: "2",
  III: "3",
  IV: "4",
  V: "5",
  VI: "6",
  VII: "7",
};

async function main() {
  console.log("=== GEMAS SPBU & USERS BULK SYNC ===");
  const jsonPath = path.join(CWD, "data/parsed_spbu_input.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error("File data/parsed_spbu_input.json tidak ditemukan!");
  }

  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  console.log(`Berhasil membaca ${parsed.length} data SPBU.`);

  if (parsed.length !== 182) {
    throw new Error(`Jumlah SPBU ${parsed.length} tidak sama dengan 182!`);
  }

  const nowIso = new Date().toISOString();
  // Password hash bcrypt untuk 'gemas123'
  const passwordHash = bcrypt.hashSync("gemas123", 8);

  // 1. Siapkan data SPBUS
  const spbuRows = parsed.map((p) => {
    const regNum = ROMAN_TO_NUM[p.region] || p.region;
    return {
      spbu_id: p.station_id,
      spbu_code: p.station_no,
      name: p.name,
      region_id: `REG-${regNum}`,
      province: p.province,
      city: p.city,
      address: p.address,
      pic_name: p.nama_abh && p.nama_abh !== "0" ? p.nama_abh : "",
      is_active: "1",
      created_at: nowIso,
    };
  });

  // 2. Siapkan data spbu_master.json
  const spbuMasterData = parsed.map((p) => ({
    id: p.station_id,
    code: p.station_no,
    name: p.name,
    region: p.region,
    province: p.province,
    city: p.city,
    address: p.address,
    nama_abh: p.nama_abh && p.nama_abh !== "0" ? p.nama_abh : "",
  }));
  fs.writeFileSync(
    path.join(CWD, "data/spbu_master.json"),
    JSON.stringify(spbuMasterData, null, 2)
  );
  console.log("data/spbu_master.json berhasil diperbarui.");

  // 3. Baca db.json lama untuk mempertahankan user PAM dan PIC Region
  const dbPath = path.join(CWD, "data/db.json");
  let existingDb = { USERS: [], SPBUS: [] };
  if (fs.existsSync(dbPath)) {
    existingDb = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  }

  // 3. Akun PAM dan PIC Region I s.d. VII (RESMI / NON-DEMO)
  const ROMAN_NAMES = ["", "I", "II", "III", "IV", "V", "VI", "VII"];
  const nonSpbuUsers = [];

  // Akun Resmi Admin PAM (Non-Demo)
  nonSpbuUsers.push({
    user_id: "U-001",
    username: "admin.pam",
    full_name: "Admin PAM / Head Office",
    email: "admin.pam@pertaminaretail.com",
    password_hash: passwordHash,
    role_id: "ADMIN_PAM",
    region_id: "",
    spbu_id: "",
    is_active: "1",
    is_demo: "0",
    created_at: nowIso,
    last_login: "",
    profile_name: "Admin PAM Pusat",
    employee_id: "",
    phone: "",
  });

  // Akun Resmi PIC Region I s.d. VII (Non-Demo)
  for (let r = 1; r <= 7; r++) {
    const regId = `REG-${r}`;
    const roman = ROMAN_NAMES[r];
    nonSpbuUsers.push({
      user_id: `U-${String(r + 1).padStart(3, "0")}`,
      username: `pic.region${r}`,
      full_name: `PIC Region ${roman}`,
      email: `pic.region${r}@pertaminaretail.com`,
      password_hash: passwordHash,
      role_id: "ADMIN_REGION",
      region_id: regId,
      spbu_id: "",
      is_active: "1",
      is_demo: "0",
      created_at: nowIso,
      last_login: "",
      profile_name: `PIC Region ${roman}`,
      employee_id: "",
      phone: "",
    });
  }

  // 4. Buat Akun Admin SPBU untuk seluruh 182 SPBU
  let userIdx = 9; // mulai dari U-009
  const spbuUserRows = spbuRows.map((s, idx) => {
    const uid = `U-${String(userIdx + idx).padStart(3, "0")}`;
    const stationIdClean = s.spbu_id;
    return {
      user_id: uid,
      username: `spbu${stationIdClean}`,
      full_name: s.name,
      email: `spbu${stationIdClean}@gemas.pertaminaretail.com`,
      password_hash: passwordHash,
      role_id: "ADMIN_SPBU",
      region_id: s.region_id,
      spbu_id: s.spbu_id,
      is_active: "1",
      is_demo: "0",
      created_at: nowIso,
      last_login: "",
      profile_name: s.pic_name || "",
      employee_id: parsed[idx]?.plant || "",
      phone: "",
    };
  });

  const allUsers = [...nonSpbuUsers, ...spbuUserRows];
  console.log(`Total akun pengguna: ${allUsers.length} (${nonSpbuUsers.length} admin/PIC + ${spbuUserRows.length} Admin SPBU).`);

  // 5. Update data/db.json
  existingDb.SPBUS = spbuRows;
  existingDb.USERS = allUsers;
  fs.writeFileSync(dbPath, JSON.stringify(existingDb, null, 2));
  console.log("data/db.json berhasil diperbarui secara lokal.");

  // 6. Update ke Google Sheets
  const sheetsId = getActiveSheetsId();
  console.log(`Menghubungkan ke Google Sheets ID: ${sheetsId}...`);
  const { sheets } = getGoogleClients();

  // Update SPBUS di Google Sheets
  console.log("Memperbarui tab SPBUS di Google Sheets...");
  const spbuHeader = SCHEMA.SPBUS;
  const spbuValues = spbuRows.map((r) => spbuHeader.map((c) => r[c] || ""));
  
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetsId,
    range: `SPBUS!A2:Z1000`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsId,
    range: `SPBUS!A2`,
    valueInputOption: "RAW",
    requestBody: { values: spbuValues },
  });
  console.log(`Tab SPBUS di Google Sheets berhasil diisi ${spbuValues.length} baris.`);

  // Update USERS di Google Sheets
  console.log("Memperbarui tab USERS di Google Sheets...");
  const userHeader = SCHEMA.USERS;
  const userValues = allUsers.map((r) => userHeader.map((c) => r[c] || ""));

  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetsId,
    range: `USERS!A2:Z1000`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsId,
    range: `USERS!A2`,
    valueInputOption: "RAW",
    requestBody: { values: userValues },
  });
  console.log(`Tab USERS di Google Sheets berhasil diisi ${userValues.length} baris.`);

  // Verifikasi membaca kembali dari Google Sheets
  const verifySpbu = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `SPBUS!A2:C5`,
  });
  console.log("Sampel SPBUS dari Sheets:", verifySpbu.data.values);

  const verifyUser = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `USERS!A2:D5`,
  });
  console.log("Sampel USERS dari Sheets:", verifyUser.data.values);

  console.log("=== SEMUA PROSES SYNC GOOGLE SHEETS & DATABASE SELESAI DENGAN SUKSES! ===");
}

main().catch((err) => {
  console.error("Gagal sinkronisasi:", err);
  process.exit(1);
});
