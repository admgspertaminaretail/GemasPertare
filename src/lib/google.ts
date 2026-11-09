import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { Row, SCHEMA, TABLES, TableName, normalize } from "./schema";

const DATA_DIR = process.env.VERCEL ? "/tmp/gemas" : path.join(process.cwd(), "data");
export const CREDENTIALS_DIR = path.join(process.cwd(), "credentials");
export const DEFAULT_KEY_PATH = path.join(CREDENTIALS_DIR, "service-account.json");
const CLOUD_CONFIG_FILE = path.join(DATA_DIR, "cloud-config.json");

export const STORAGE_FOLDER_NAME = "GEMAS_Arsip_Storage";
export const SPREADSHEET_NAME = "GEMAS_Database_Master";
export const SUBFOLDER_NAMES = ["submissions", "templates", "knowledge", "ibos", "slides"] as const;

export interface GoogleCredentialsInfo {
  email: string;
  privateKey: string;
  projectId: string;
  source: string;
}

export interface CloudConfig {
  dbDriver?: "local" | "sheets";
  fileDriver?: "local" | "drive";
  sheetsId?: string;
  driveFolderId?: string;
  parentFolderId?: string;
  shareEmail?: string;
  subfolders?: Record<string, string>;
  initializedAt?: string;
}

/** Membaca konfigurasi cloud yang tersimpan di data/cloud-config.json. */
export function readCloudConfig(): CloudConfig {
  try {
    if (fs.existsSync(CLOUD_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CLOUD_CONFIG_FILE, "utf8")) as CloudConfig;
    }
  } catch { /* abaikan */ }
  return {};
}

/** Menyimpan konfigurasi ke data/cloud-config.json dan menyinkronkannya ke .env.local (di luar Vercel). */
export function saveCloudConfig(patch: Partial<CloudConfig>): CloudConfig {
  const next: CloudConfig = { ...readCloudConfig(), ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CLOUD_CONFIG_FILE, JSON.stringify(next, null, 2));

  if (next.dbDriver) process.env.DB_DRIVER = next.dbDriver;
  if (next.fileDriver) process.env.FILE_DRIVER = next.fileDriver;
  if (next.sheetsId !== undefined) process.env.GOOGLE_SHEETS_ID = next.sheetsId;
  if (next.driveFolderId !== undefined) process.env.GOOGLE_DRIVE_FOLDER_ID = next.driveFolderId;

  if (!process.env.VERCEL) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
      const updates: Record<string, string | undefined> = {
        DB_DRIVER: next.dbDriver,
        FILE_DRIVER: next.fileDriver,
        GOOGLE_SHEETS_ID: next.sheetsId,
        GOOGLE_DRIVE_FOLDER_ID: next.driveFolderId,
      };
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined) continue;
        const re = new RegExp(`^${k}=.*$`, "m");
        if (re.test(content)) content = content.replace(re, `${k}=${v}`);
        else content = content.trimEnd() + `\n${k}=${v}\n`;
      }
      fs.writeFileSync(envPath, content);
    } catch { /* abaikan jika read-only */ }
  }
  return next;
}

export function getActiveDbDriver(): "local" | "sheets" {
  const cfg = readCloudConfig();
  return (cfg.dbDriver || (process.env.DB_DRIVER as "local" | "sheets") || "local") === "sheets" ? "sheets" : "local";
}

export function getActiveFileDriver(): "local" | "drive" {
  const cfg = readCloudConfig();
  return (cfg.fileDriver || (process.env.FILE_DRIVER as "local" | "drive") || "local") === "drive" ? "drive" : "local";
}

export function getActiveSheetsId(): string {
  return readCloudConfig().sheetsId || process.env.GOOGLE_SHEETS_ID || "";
}

export function getActiveDriveFolderId(category?: string): string {
  const cfg = readCloudConfig();
  if (category && cfg.subfolders) {
    const top = category.split("/")[0];
    if (cfg.subfolders[top]) return cfg.subfolders[top];
  }
  return cfg.driveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "";
}

/** Mengekstrak ID dari URL Google Drive / Google Sheets maupun ID mentah. */
export function parseGoogleId(input?: string): string {
  const s = (input || "").trim();
  if (!s) return "";
  const folderMatch = s.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const sheetMatch = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch) return sheetMatch[1];
  const idParam = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  return s.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Mencari kredensial Google Service Account secara otomatis dari:
 * 1. File `credentials/service-account.json` (atau file *.json Service Account di dalam folder `credentials/`)
 * 2. Path pada env `GOOGLE_APPLICATION_CREDENTIALS`
 * 3. Variabel env `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`
 */
export function loadGoogleCredentials(): GoogleCredentialsInfo | null {
  const candidates: { file: string; label: string }[] = [];
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    candidates.push({
      file: path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS),
      label: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }
  candidates.push({ file: DEFAULT_KEY_PATH, label: "credentials/service-account.json" });
  if (fs.existsSync(CREDENTIALS_DIR)) {
    for (const f of fs.readdirSync(CREDENTIALS_DIR)) {
      if (f.endsWith(".json") && f !== "service-account.json") {
        candidates.push({ file: path.join(CREDENTIALS_DIR, f), label: `credentials/${f}` });
      }
    }
  }
  for (const c of candidates) {
    try {
      if (!fs.existsSync(c.file)) continue;
      const raw = JSON.parse(fs.readFileSync(c.file, "utf8"));
      if (raw.client_email && raw.private_key) {
        return {
          email: String(raw.client_email),
          privateKey: String(raw.private_key).replace(/\\n/g, "\n"),
          projectId: String(raw.project_id || ""),
          source: c.label,
        };
      }
    } catch { /* lewati file JSON yang tidak valid */ }
  }

  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  let key = (process.env.GOOGLE_PRIVATE_KEY || "").trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  if (email && key) {
    return { email, privateKey: key, projectId: "", source: "Environment Variables (.env.local)" };
  }
  return null;
}

export function saveServiceAccountJson(rawText: string): GoogleCredentialsInfo {
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("File yang dipilih bukan format JSON yang valid.");
  }
  if (!parsed?.client_email || !parsed?.private_key || parsed?.type !== "service_account") {
    throw new Error(
      'File JSON ini bukan kunci Google Service Account. Pastikan file memiliki field "type": "service_account", "client_email", dan "private_key".'
    );
  }
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  fs.writeFileSync(DEFAULT_KEY_PATH, JSON.stringify(parsed, null, 2), { mode: 0o600 });
  return {
    email: String(parsed.client_email),
    privateKey: String(parsed.private_key).replace(/\\n/g, "\n"),
    projectId: String(parsed.project_id || ""),
    source: "credentials/service-account.json",
  };
}

export function getGoogleClients() {
  const cred = loadGoogleCredentials();
  if (!cred) {
    throw new Error(
      "File kunci Google Service Account belum ditemukan. Letakkan file JSON kunci di folder credentials/service-account.json."
    );
  }
  const auth = new google.auth.JWT({
    email: cred.email,
    key: cred.privateKey,
    scopes: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return {
    cred,
    auth,
    drive: google.drive({ version: "v3", auth }),
    sheets: google.sheets({ version: "v4", auth }),
  };
}

function friendlyGoogleError(err: any, email: string): Error {
  const msg = String(err?.response?.data?.error?.message || err?.message || err);
  if (/storageQuotaExceeded|do not have storage quota/i.test(msg)) {
    return new Error(
      `Akun Gmail pribadi membatasi pembuatan file baru oleh Service Account: buka folder Google Drive Anda, klik "+ Baru (New) → Google Spreadsheet" (biarkan kosong), lalu klik "Inisialisasi Otomatis" lagi — sistem akan otomatis mengisi 19 tab & seluruh datanya!`
    );
  }
  if (/has not been used in project|is disabled|accessNotConfigured/i.test(msg)) {
    return new Error(
      `Google Drive API atau Google Sheets API belum diaktifkan di Google Cloud Console Anda. Aktifkan kedua API tersebut terlebih dahulu. (${msg})`
    );
  }
  if (/File not found|notFound|insufficientFilePermissions|The caller does not have permission/i.test(msg)) {
    return new Error(
      `Service Account (${email}) belum memiliki akses Editor ke folder/spreadsheet tersebut. Pastikan Anda sudah klik Share → Editor ke email Service Account.`
    );
  }
  return new Error(`Gagal menghubungi Google API: ${msg}`);
}

export interface AutoInitOptions {
  parentFolderId?: string;
  existingSheetsId?: string;
  existingDriveFolderId?: string;
  shareEmail?: string;
  /** "migrate" menyalin seluruh data lokal saat ini jika sheet USERS masih kosong; "master" hanya data master; "force_sync" menimpa dengan data lokal. */
  seedMode?: "migrate" | "master" | "force_sync" | "none";
  activate?: boolean;
  localRowsProvider?: () => Promise<Record<TableName, Row[]>>;
}

export interface AutoInitResult {
  serviceAccountEmail: string;
  credentialSource: string;
  driveFolderId: string;
  folderUrl: string;
  folderCreated: boolean;
  subfolders: Record<string, string>;
  sheetsId: string;
  spreadsheetUrl: string;
  spreadsheetCreated: boolean;
  createdTabs: string[];
  seededRows: number;
  activated: boolean;
}

async function findOrCreateFolder(drive: ReturnType<typeof google.drive>, name: string, parentId?: string, knownId?: string): Promise<{ id: string; created: boolean }> {
  if (knownId) {
    try {
      const check = await drive.files.get({ fileId: knownId, fields: "id, trashed", supportsAllDrives: true });
      if (check.data.id && !check.data.trashed) return { id: check.data.id, created: false };
    } catch { /* jika tidak ditemukan, lanjut cari/buat baru */ }
  }
  const safeName = name.replace(/'/g, "\\'");
  const parentClause = parentId ? ` and '${parentId}' in parents` : "";
  const list = await drive.files.list({
    q: `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false${parentClause}`,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (list.data.files && list.data.files.length > 0 && list.data.files[0].id) {
    return { id: list.data.files[0].id, created: false };
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return { id: String(created.data.id), created: true };
}

async function findOrCreateSpreadsheet(
  drive: ReturnType<typeof google.drive>,
  sheets: ReturnType<typeof google.sheets>,
  name: string,
  parentId?: string,
  knownId?: string,
  fallbackFolderIds: string[] = []
): Promise<{ id: string; created: boolean }> {
  if (knownId) {
    try {
      const check = await sheets.spreadsheets.get({ spreadsheetId: knownId, fields: "spreadsheetId" });
      if (check.data.spreadsheetId) return { id: check.data.spreadsheetId, created: false };
    } catch { /* lanjut cari/buat baru */ }
  }
  const safeName = name.replace(/'/g, "\\'");
  const candidateFolders = Array.from(new Set([parentId, ...fallbackFolderIds].filter(Boolean) as string[]));
  for (const folderId of candidateFolders.length ? candidateFolders : [""]) {
    const parentClause = folderId ? ` and '${folderId}' in parents` : "";
    const list = await drive.files.list({
      q: `mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${safeName}' and trashed = false${parentClause}`,
      fields: "files(id, name)",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (list.data.files && list.data.files.length > 0 && list.data.files[0].id) {
      return { id: list.data.files[0].id, created: false };
    }
  }
  // Buat lewat Drive API agar langsung masuk ke dalam parentId; bila akun Gmail pribadi membatasi kuota Service Account, pakai Spreadsheet kosong yang ada di folder induk / GEMAS_Arsip_Storage / yang dibagikan ke Service Account
  try {
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.spreadsheet",
        ...(parentId ? { parents: [parentId] } : {}),
      },
      fields: "id",
      supportsAllDrives: true,
    });
    return { id: String(created.data.id), created: true };
  } catch (err: any) {
    for (const folderId of candidateFolders) {
      const anySheet = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and '${folderId}' in parents`,
        orderBy: "modifiedTime desc",
        fields: "files(id, name)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (anySheet.data.files && anySheet.data.files.length > 0 && anySheet.data.files[0].id) {
        const foundId = anySheet.data.files[0].id;
        try {
          await drive.files.update({ fileId: foundId, requestBody: { name }, supportsAllDrives: true });
        } catch { /* abaikan bila tidak bisa rename */ }
        return { id: foundId, created: false };
      }
    }
    // Cadangan terakhir: cek apakah ada Spreadsheet yang baru saja dibagikan langsung ke Service Account
    try {
      const sharedSheet = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        orderBy: "modifiedTime desc",
        fields: "files(id, name)",
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      if (sharedSheet.data.files && sharedSheet.data.files.length > 0 && sharedSheet.data.files[0].id) {
        const foundId = sharedSheet.data.files[0].id;
        try {
          await drive.files.update({ fileId: foundId, requestBody: { name }, supportsAllDrives: true });
        } catch { /* abaikan bila tidak bisa rename */ }
        return { id: foundId, created: false };
      }
    } catch { /* lanjut lempar error asli */ }
    throw err;
  }
}

/**
 * AUTOMATIC INITIALIZATION:
 * Menghubungkan ke Google Drive & Google Sheets, otomatis membuat folder penyimpanan (+ subfolder)
 * dan Spreadsheet pelacak beserta seluruh tab & kolom resmi GEMAS jika belum ada.
 */
export async function autoInitializeGoogleWorkspace(opts: AutoInitOptions = {}): Promise<AutoInitResult> {
  const { cred, drive, sheets } = getGoogleClients();
  const saved = readCloudConfig();
  const rawParentInput = (opts.parentFolderId ?? saved.parentFolderId ?? "").trim();
  const pastedSheetMatch = rawParentInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const parentId = pastedSheetMatch ? parseGoogleId(saved.parentFolderId) : parseGoogleId(rawParentInput);
  const knownFolderId = parseGoogleId(opts.existingDriveFolderId) || saved.driveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "";
  const knownSheetsId = (pastedSheetMatch ? pastedSheetMatch[1] : "") || parseGoogleId(opts.existingSheetsId) || saved.sheetsId || process.env.GOOGLE_SHEETS_ID || "";
  const shareEmail = (opts.shareEmail ?? saved.shareEmail ?? "").trim();

  try {
    // 1. Pastikan folder utama penyimpanan di Google Drive tersedia (buat otomatis jika belum ada)
    const rootFolder = await findOrCreateFolder(drive, STORAGE_FOLDER_NAME, parentId || undefined, knownFolderId || undefined);

    // 2. Pastikan subfolder kategori arsip tersedia di dalam folder utama
    const subfolders: Record<string, string> = {};
    for (const sub of SUBFOLDER_NAMES) {
      const sf = await findOrCreateFolder(drive, sub, rootFolder.id, saved.subfolders?.[sub]);
      subfolders[sub] = sf.id;
    }

    // 3. Pastikan Spreadsheet database utama tersedia (buat otomatis di folder induk / folder utama jika belum ada)
    const sheetPlacement = parentId || rootFolder.id;
    const ss = await findOrCreateSpreadsheet(
      drive,
      sheets,
      SPREADSHEET_NAME,
      sheetPlacement,
      knownSheetsId || undefined,
      [parentId, rootFolder.id].filter(Boolean)
    );

    // 4. Pastikan seluruh 19 tab tabel GEMAS + kolom header sesuai SCHEMA + format header baris 1
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ss.id });
    const sheetList = meta.data.sheets || [];
    const existingByTitle = new Map<string, number>();
    for (const s of sheetList) {
      if (s.properties?.title && typeof s.properties.sheetId === "number") {
        existingByTitle.set(s.properties.title, s.properties.sheetId);
      }
    }

    const createdTabs: string[] = [];
    const addRequests: any[] = [];
    for (const t of TABLES) {
      if (!existingByTitle.has(t)) {
        createdTabs.push(t);
        addRequests.push({
          addSheet: {
            properties: {
              title: t,
              gridProperties: { frozenRowCount: 1, rowCount: 1000, columnCount: Math.max(SCHEMA[t].length + 2, 12) },
            },
          },
        });
      }
    }
    if (addRequests.length > 0) {
      const batchRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ss.id,
        requestBody: { requests: addRequests },
      });
      for (const reply of batchRes.data.replies || []) {
        const p = reply.addSheet?.properties;
        if (p?.title && typeof p.sheetId === "number") existingByTitle.set(p.title, p.sheetId);
      }
    }

    // Tulis baris header kolom untuk seluruh tab yang baru dibuat (atau yang baris pertamanya masih kosong)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ss.id,
      requestBody: {
        valueInputOption: "RAW",
        data: TABLES.map((t) => ({ range: `${t}!A1`, values: [[...SCHEMA[t]]] })),
      },
    });

    // Format visual header (biru tua Pertamina #163B63 + teks putih tebal + bekukan baris 1) & hapus Sheet1 default bila kosong
    const styleRequests: any[] = [];
    for (const t of TABLES) {
      const sid = existingByTitle.get(t);
      if (sid === undefined) continue;
      styleRequests.push(
        {
          updateSheetProperties: {
            properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: SCHEMA[t].length },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.086, green: 0.231, blue: 0.388 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        }
      );
    }
    for (const [title, sid] of existingByTitle.entries()) {
      if ((title === "Sheet1" || title === "Lembar1") && !TABLES.includes(title as TableName) && existingByTitle.size > 1) {
        styleRequests.push({ deleteSheet: { sheetId: sid } });
      }
    }
    if (styleRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: ss.id, requestBody: { requests: styleRequests } });
    }

    // 5. Isi data awal / migrasi data lokal apabila tab USERS masih kosong atau diminta force_sync
    let seededRows = 0;
    const mode = opts.seedMode || "migrate";
    if (mode !== "none" && opts.localRowsProvider) {
      const usersCheck = await sheets.spreadsheets.values.get({ spreadsheetId: ss.id, range: "USERS!A2:A3" });
      const isEmpty = !usersCheck.data.values || usersCheck.data.values.length === 0;
      if (isEmpty || mode === "force_sync") {
        const sourceDb = await opts.localRowsProvider();
        for (const t of TABLES) {
          const rows = sourceDb[t] || [];
          if (mode === "force_sync") {
            await sheets.spreadsheets.values.clear({ spreadsheetId: ss.id, range: `${t}!A2:ZZ` });
          }
          if (!rows.length) continue;
          const values = rows.map((r) => SCHEMA[t].map((c) => normalize(t, r)[c]));
          for (let i = 0; i < values.length; i += 300) {
            const chunk = values.slice(i, i + 300);
            await sheets.spreadsheets.values.append({
              spreadsheetId: ss.id,
              range: `${t}!A1`,
              valueInputOption: "RAW",
              insertDataOption: "INSERT_ROWS",
              requestBody: { values: chunk },
            });
            seededRows += chunk.length;
          }
        }
      }
    }

    // 6. Bagikan otomatis ke email pengguna jika diisi (mendukung satu atau beberapa email dipisah koma)
    const targetEmails = shareEmail
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.toLowerCase() !== cred.email.toLowerCase());
    for (const addr of targetEmails) {
      for (const resourceId of [rootFolder.id, ss.id]) {
        try {
          await drive.permissions.create({
            fileId: resourceId,
            sendNotificationEmail: false,
            supportsAllDrives: true,
            requestBody: { type: "user", role: "writer", emailAddress: addr },
          });
        } catch { /* abaikan jika sudah dibagikan atau di dalam folder milik pengguna sendiri */ }
      }
    }

    const activate = opts.activate !== false;
    saveCloudConfig({
      sheetsId: ss.id,
      driveFolderId: rootFolder.id,
      parentFolderId: parentId,
      shareEmail,
      subfolders,
      initializedAt: new Date().toISOString(),
      ...(activate ? { dbDriver: "sheets", fileDriver: "drive" } : {}),
    });

    return {
      serviceAccountEmail: cred.email,
      credentialSource: cred.source,
      driveFolderId: rootFolder.id,
      folderUrl: `https://drive.google.com/drive/folders/${rootFolder.id}`,
      folderCreated: rootFolder.created,
      subfolders,
      sheetsId: ss.id,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${ss.id}/edit`,
      spreadsheetCreated: ss.created,
      createdTabs,
      seededRows,
      activated: activate,
    };
  } catch (err: any) {
    throw friendlyGoogleError(err, cred.email);
  }
}
