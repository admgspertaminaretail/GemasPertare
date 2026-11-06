#!/usr/bin/env node
/**
 * Skrip CLI Inisialisasi Otomatis Google Drive & Google Sheets untuk GEMAS.
 * Cara pakai:
 *   npm run db:init
 *   npm run db:init -- --folder="https://drive.google.com/drive/folders/..." --email="anda@gmail.com"
 */
import fs from "fs";
import path from "path";
import { google } from "googleapis";

const ROOT = process.cwd();
const CRED_DIR = path.join(ROOT, "credentials");
const DATA_DIR = path.join(ROOT, "data");
const CLOUD_CONFIG_FILE = path.join(DATA_DIR, "cloud-config.json");
const LOCAL_DB_FILE = path.join(DATA_DIR, "db.json");

const STORAGE_FOLDER_NAME = "GEMAS_Arsip_Storage";
const SPREADSHEET_NAME = "GEMAS_Database_Master";
const SUBFOLDERS = ["submissions", "templates", "knowledge"];

// Skema 19 tabel GEMAS (identik dengan src/lib/schema.ts)
const SCHEMA = {
  ROLES: ["role_id", "role_name", "description"],
  USERS: ["user_id", "username", "full_name", "email", "password_hash", "role_id", "region_id", "spbu_id", "is_active", "is_demo", "created_at", "last_login"],
  REGIONS: ["region_id", "region_name", "is_active"],
  SPBUS: ["spbu_id", "spbu_code", "name", "region_id", "province", "city", "address", "pic_name", "is_active", "created_at"],
  SUBMISSIONS: ["submission_id", "spbu_id", "region_id", "submission_date", "description", "status", "current_revision", "submitted_by", "created_at", "updated_at", "last_review_note", "is_demo"],
  SUBMISSION_DOCUMENTS: ["doc_id", "submission_id", "revision_id", "doc_type", "file_name", "mime", "size", "storage_ref", "uploaded_by", "uploaded_at", "is_current", "meta"],
  SUBMISSION_PHOTOS: ["photo_id", "submission_id", "revision_id", "file_name", "mime", "size", "storage_ref", "uploaded_by", "uploaded_at", "is_current"],
  SUBMISSION_REVISION_HISTORY: ["revision_id", "submission_id", "revision_no", "requested_note", "requested_by", "requested_by_name", "requested_at", "resubmitted_at", "resubmitted_by", "resubmit_note"],
  SUBMISSION_STATUS_HISTORY: ["history_id", "submission_id", "from_status", "to_status", "changed_by", "changed_by_name", "changed_by_role", "changed_at", "note"],
  REGIONAL_POOLINGS: ["pooling_id", "fupa_number", "pooling_date", "region_id", "notes", "status", "created_by", "created_at", "cancelled_at", "cancel_reason"],
  REGIONAL_POOLING_ITEMS: ["item_id", "pooling_id", "submission_id", "spbu_id", "status", "added_at"],
  REGIONAL_MEMOS: ["memo_id", "memo_number", "memo_date", "region_id", "notes", "created_by", "created_at"],
  MEMO_POOLING_ITEMS: ["id", "memo_id", "pooling_id"],
  MEMO_FORWARDING: ["forwarding_id", "memo_id", "status", "forwarded_date", "notes", "updated_by", "updated_at"],
  KNOWLEDGE_DOCUMENTS: ["doc_id", "title", "category", "description", "version", "status", "managed_by", "uploaded_at", "file_name", "mime", "size", "storage_ref", "use_for_ai", "ai_status", "is_demo"],
  TEMPLATES: ["template_id", "name", "category", "version", "description", "usage_info", "status", "updated_at", "updated_by", "file_name", "mime", "size", "storage_ref", "is_demo"],
  AI_KNOWLEDGE_BASE: ["chunk_id", "doc_id", "doc_title", "doc_version", "page", "chunk_index", "text", "created_at"],
  ACTIVITY_LOGS: ["log_id", "timestamp", "user_id", "user_name", "role_id", "action", "entity_type", "entity_id", "details"],
  FILE_INDEX: ["file_id", "title", "category", "entity_id", "file_name", "mime_type", "size_bytes", "storage_ref", "file_url", "uploaded_by", "timestamp"],
};
const TABLES = Object.keys(SCHEMA);

function parseArg(flag) {
  const found = process.argv.find((a) => a.startsWith(`${flag}=`));
  return found ? found.slice(flag.length + 1) : "";
}

function parseGoogleId(input = "") {
  const s = input.trim();
  if (!s) return "";
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s.replace(/[^a-zA-Z0-9_-]/g, "");
}

function loadCredentials() {
  const files = [path.join(CRED_DIR, "service-account.json")];
  if (fs.existsSync(CRED_DIR)) {
    for (const f of fs.readdirSync(CRED_DIR)) {
      if (f.endsWith(".json") && f !== "service-account.json") files.push(path.join(CRED_DIR, f));
    }
  }
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const raw = JSON.parse(fs.readFileSync(f, "utf8"));
    if (raw.client_email && raw.private_key) {
      return { email: raw.client_email, privateKey: raw.private_key, source: path.relative(ROOT, f) };
    }
  }
  throw new Error(
    `File kunci Service Account tidak ditemukan!\nLetakkan file JSON kunci Google Anda di: ${path.join(CRED_DIR, "service-account.json")}`
  );
}

async function findOrCreate(drive, name, mimeType, parentId) {
  const safe = name.replace(/'/g, "\\'");
  const q = `mimeType = '${mimeType}' and name = '${safe}' and trashed = false` + (parentId ? ` and '${parentId}' in parents` : "");
  const list = await drive.files.list({ q, fields: "files(id, name)", pageSize: 1, supportsAllDrives: true, includeItemsFromAllDrives: true });
  if (list.data.files?.length) return { id: list.data.files[0].id, created: false };
  const created = await drive.files.create({
    requestBody: { name, mimeType, ...(parentId ? { parents: [parentId] } : {}) },
    fields: "id",
    supportsAllDrives: true,
  });
  return { id: created.data.id, created: true };
}

async function main() {
  console.log("=== GEMAS — Inisialisasi Otomatis Google Drive & Google Sheets ===");
  const cred = loadCredentials();
  console.log(`✓ Kredensial ditemukan : ${cred.source}`);
  console.log(`✓ Service Account      : ${cred.email}`);

  const saved = fs.existsSync(CLOUD_CONFIG_FILE) ? JSON.parse(fs.readFileSync(CLOUD_CONFIG_FILE, "utf8")) : {};
  const parentId = parseGoogleId(parseArg("--folder") || saved.parentFolderId || "");
  const shareEmail = (parseArg("--email") || saved.shareEmail || "").trim();

  const auth = new google.auth.JWT({
    email: cred.email,
    key: cred.privateKey,
    scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/spreadsheets"],
  });
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  const rootFolder = await findOrCreate(drive, STORAGE_FOLDER_NAME, "application/vnd.google-apps.folder", parentId || undefined);
  console.log(`✓ Folder Utama Drive   : https://drive.google.com/drive/folders/${rootFolder.id} (${rootFolder.created ? "BARU DIBUAT" : "SUDAH ADA"})`);

  const subfolders = {};
  for (const sub of SUBFOLDERS) {
    const sf = await findOrCreate(drive, sub, "application/vnd.google-apps.folder", rootFolder.id);
    subfolders[sub] = sf.id;
  }

  const ss = await findOrCreate(drive, SPREADSHEET_NAME, "application/vnd.google-apps.spreadsheet", parentId || rootFolder.id);
  console.log(`✓ Spreadsheet Database : https://docs.google.com/spreadsheets/d/${ss.id}/edit (${ss.created ? "BARU DIBUAT" : "SUDAH ADA"})`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: ss.id });
  const existing = new Map((meta.data.sheets || []).map((s) => [s.properties.title, s.properties.sheetId]));
  const addReqs = TABLES.filter((t) => !existing.has(t)).map((t) => ({
    addSheet: { properties: { title: t, gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: Math.max(SCHEMA[t].length + 2, 12) } } },
  }));
  if (addReqs.length) {
    const r = await sheets.spreadsheets.batchUpdate({ spreadsheetId: ss.id, requestBody: { requests: addReqs } });
    for (const rep of r.data.replies || []) {
      if (rep.addSheet?.properties) existing.set(rep.addSheet.properties.title, rep.addSheet.properties.sheetId);
    }
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ss.id,
    requestBody: { valueInputOption: "RAW", data: TABLES.map((t) => ({ range: `${t}!A1`, values: [SCHEMA[t]] })) },
  });
  console.log(`✓ Seluruh ${TABLES.length} tab & kolom header berhasil diverifikasi.`);

  // Migrasi data awal dari data/db.json bila USERS masih kosong
  if (fs.existsSync(LOCAL_DB_FILE)) {
    const uCheck = await sheets.spreadsheets.values.get({ spreadsheetId: ss.id, range: "USERS!A2:A3" });
    if (!uCheck.data.values?.length) {
      const localDb = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, "utf8"));
      let total = 0;
      for (const t of TABLES) {
        const rows = localDb[t] || [];
        if (!rows.length) continue;
        const vals = rows.map((r) => SCHEMA[t].map((c) => (r[c] === undefined || r[c] === null ? "" : String(r[c]))));
        for (let i = 0; i < vals.length; i += 300) {
          const chunk = vals.slice(i, i + 300);
          await sheets.spreadsheets.values.append({
            spreadsheetId: ss.id, range: `${t}!A1`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: chunk },
          });
          total += chunk.length;
        }
      }
      console.log(`✓ ${total} baris data lokal berhasil dimigrasikan ke Google Sheets.`);
    }
  }

  if (shareEmail && shareEmail.includes("@")) {
    for (const id of [rootFolder.id, ss.id]) {
      try {
        await drive.permissions.create({
          fileId: id, sendNotificationEmail: false, supportsAllDrives: true,
          requestBody: { type: "user", role: "writer", emailAddress: shareEmail },
        });
      } catch { /* abaikan */ }
    }
    console.log(`✓ Akses Editor dibagikan ke: ${shareEmail}`);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CLOUD_CONFIG_FILE, JSON.stringify({
    dbDriver: "sheets", fileDriver: "drive", sheetsId: ss.id, driveFolderId: rootFolder.id,
    parentFolderId: parentId, shareEmail, subfolders, initializedAt: new Date().toISOString(),
  }, null, 2));

  console.log("\nSelesai! Konfigurasi disimpan ke data/cloud-config.json dan siap digunakan oleh aplikasi.");
}

main().catch((err) => {
  console.error("\n✗ Gagal melakukan inisialisasi:", err?.response?.data?.error?.message || err.message);
  process.exit(1);
});
