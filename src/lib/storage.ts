import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { UPLOAD_DIR } from "./store";
import { autoInitializeGoogleWorkspace, getActiveAppsScriptUrl, getActiveDriveFolderId, getActiveFileDriver, getGoogleClients, loadGoogleCredentials } from "./google";
import { getLocalSnapshot, getStore } from "./db";

export type FileKind = "excel" | "pdf" | "image" | "document";

const RULES: Record<FileKind, { ext: string[]; mime: string }> = {
  excel: { ext: [".xlsx"], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pdf: { ext: [".pdf"], mime: "application/pdf" },
  image: { ext: [".jpg", ".jpeg", ".png"], mime: "image/jpeg" },
  document: { ext: [".pdf", ".xlsx", ".docx"], mime: "application/octet-stream" },
};

export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_MB || 4) * 1024 * 1024;

function sniff(buf: Buffer): "pdf" | "zip" | "jpg" | "png" | "unknown" {
  if (buf.length < 4) return "unknown";
  if (buf.slice(0, 4).toString() === "%PDF") return "pdf";
  if (buf[0] === 0x50 && buf[1] === 0x4b) return "zip";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf.slice(1, 4).toString() === "PNG") return "png";
  return "unknown";
}

export interface ValidatedFile {
  buffer: Buffer;
  name: string;
  mime: string;
  size: number;
}

/** Validasi ekstensi, ukuran, dan magic-bytes. Melempar Error berpesan Indonesia jika tidak valid. */
export async function validateUpload(file: File | null | undefined, kind: FileKind, label: string): Promise<ValidatedFile> {
  if (!file || typeof file === "string" || !file.size) throw new Error(`${label} wajib diunggah.`);
  if (file.size > MAX_FILE_BYTES)
    throw new Error(`${label}: ukuran file melebihi batas ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  const rule = RULES[kind];
  const ext = path.extname(file.name || "").toLowerCase();
  if (!rule.ext.includes(ext)) throw new Error(`${label}: format harus ${rule.ext.join("/").toUpperCase()}.`);
  const buffer = Buffer.from(await file.arrayBuffer());
  const t = sniff(buffer);
  const ok =
    (ext === ".pdf" && t === "pdf") ||
    ((ext === ".xlsx" || ext === ".docx") && t === "zip") ||
    ((ext === ".jpg" || ext === ".jpeg") && t === "jpg") ||
    (ext === ".png" && t === "png");
  if (!ok) throw new Error(`${label}: isi file tidak sesuai dengan format ${ext.toUpperCase()}.`);
  const mime =
    ext === ".pdf" ? "application/pdf"
    : ext === ".xlsx" ? RULES.excel.mime
    : ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : ext === ".png" ? "image/png"
    : "image/jpeg";
  const name = (file.name || "file").replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  return { buffer, name, mime, size: buffer.length };
}

export interface FileIndexMeta {
  title?: string;
  entityId?: string;
  uploadedBy?: string;
}

async function uploadViaAppsScript(
  f: { buffer: Buffer; name: string; mime: string },
  folderId: string,
  scriptUrl: string
): Promise<{ id: string; webViewLink: string }> {
  const payload = {
    fileName: f.name,
    mimeType: f.mime,
    base64: f.buffer.toString("base64"),
    folderId,
  };
  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Apps Script upload HTTP ${res.status}: ${res.statusText}`);
  }
  const data = (await res.json()) as { success?: boolean; fileId?: string; fileUrl?: string; error?: string };
  if (!data.success || !data.fileId) {
    throw new Error(`Apps Script upload error: ${data.error || "Gagal mengunggah file ke Google Drive"}`);
  }
  return {
    id: data.fileId,
    webViewLink: data.fileUrl || `https://drive.google.com/file/d/${data.fileId}/view`,
  };
}

/** Menyimpan file; mengembalikan storage_ref (link Drive atau local path) dan mencatat otomatis ke tabel FILE_INDEX. */
export async function saveFile(
  f: { buffer: Buffer; name: string; mime: string },
  folder: string,
  meta: FileIndexMeta = {}
): Promise<string> {
  const safe = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${f.name}`;
  let storageRef = "";
  let fileUrl = "";

  if (getActiveFileDriver() === "drive") {
    let parentId = getActiveDriveFolderId(folder);
    if (!parentId && loadGoogleCredentials()) {
      const init = await autoInitializeGoogleWorkspace({ seedMode: "migrate", activate: true, localRowsProvider: getLocalSnapshot });
      parentId = init.subfolders[folder.split("/")[0]] || init.driveFolderId;
    }
    if (!parentId) throw new Error("Folder Google Drive belum siap. Jalankan Inisialisasi Otomatis di menu Database & Cloud.");

    // Coba upload lewat Google Apps Script bridge jika URL telah dikonfigurasi
    const appsScriptUrl = getActiveAppsScriptUrl();
    if (appsScriptUrl) {
      try {
        const uploaded = await uploadViaAppsScript(f, parentId, appsScriptUrl);
        storageRef = `https://drive.google.com/file/d/${uploaded.id}/view`;
        fileUrl = uploaded.webViewLink || storageRef;
      } catch (scriptErr: any) {
        console.error("Upload via Apps Script bridge gagal, mencoba direct Drive API:", scriptErr?.message || scriptErr);
      }
    }

    if (!storageRef) {
      const { drive } = getGoogleClients();
      const prefix = folder.includes("/") ? `${folder.split("/").slice(1).join("_")}__` : "";
      try {
        const res = await drive.files.create({
          requestBody: { name: `${prefix}${safe}`, parents: [parentId] },
          media: { mimeType: f.mime, body: Readable.from(f.buffer) },
          fields: "id, webViewLink",
          supportsAllDrives: true,
        });
        const driveId = String(res.data.id);
        storageRef = `https://drive.google.com/file/d/${driveId}/view`;
        fileUrl = res.data.webViewLink || storageRef;
      } catch (err: any) {
        const msg = String(err?.response?.data?.error?.message || err?.message || err);
        if (/storageQuotaExceeded|do not have storage quota/i.test(msg)) {
          // Akun Gmail pribadi membatasi unggahan file biner oleh Service Account (0-byte quota);
          // simpan file fisik ke folder uploads server sementara indeks & database utama tetap tercatat di Google Sheets.
          const dir = path.join(UPLOAD_DIR, folder);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, safe), f.buffer);
          storageRef = `local:${folder}/${safe}`;
          fileUrl = storageRef;
        } else {
          throw err;
        }
      }
    }
  } else {
    const dir = path.join(UPLOAD_DIR, folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, safe), f.buffer);
    storageRef = `local:${folder}/${safe}`;
    fileUrl = storageRef;
  }

  // Catat otomatis ke tabel pelacak FILE_INDEX (ID, Title, FileURL, Timestamp, dll.)
  try {
    const store = await getStore();
    const existing = await store.list("FILE_INDEX");
    const nextNum = existing.reduce((m, r) => Math.max(m, Number((r.file_id || "").replace(/\D+/g, "")) || 0), 0) + 1;
    const fileId = `FIL-${String(nextNum).padStart(4, "0")}`;
    const trackedUrl = fileUrl.startsWith("local:") ? `/api/files/index/${fileId}` : fileUrl;
    await store.insert("FILE_INDEX", [{
      file_id: fileId,
      title: meta.title || f.name,
      category: folder.split("/")[0] || "general",
      entity_id: meta.entityId || (folder.includes("/") ? folder.split("/")[1] : ""),
      file_name: f.name,
      mime_type: f.mime,
      size_bytes: String(f.buffer.length),
      storage_ref: storageRef,
      file_url: trackedUrl,
      uploaded_by: meta.uploadedBy || "SYSTEM",
      timestamp: new Date().toISOString(),
    }]);
  } catch { /* jangan gagalkan unggahan utama bila pencatatan indeks sekunder terkendala */ }

  return storageRef;
}

export async function readFile(ref: string): Promise<Buffer> {
  let driveId = "";
  if (ref.startsWith("drive:")) {
    driveId = ref.slice(6);
  } else if (ref.includes("drive.google.com/file/d/")) {
    const match = ref.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) driveId = match[1];
  }

  if (driveId) {
    const { drive } = getGoogleClients();
    const res = await drive.files.get(
      { fileId: driveId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data as ArrayBuffer);
  }
  if (ref.startsWith("local:")) {
    const rel = ref.slice(6);
    const full = path.resolve(UPLOAD_DIR, rel);
    if (!full.startsWith(path.resolve(UPLOAD_DIR))) throw new Error("Path tidak valid");
    return fs.readFileSync(full);
  }
  throw new Error("storage_ref tidak dikenal: " + ref);
}
