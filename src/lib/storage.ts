import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { UPLOAD_DIR } from "./store";

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

function drive() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key || !process.env.GOOGLE_DRIVE_FOLDER_ID) throw new Error("Konfigurasi Google Drive belum lengkap.");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { google } = require("googleapis");
  const auth = new google.auth.JWT(email, undefined, key, ["https://www.googleapis.com/auth/drive"]);
  return google.drive({ version: "v3", auth });
}

/** Menyimpan file; mengembalikan storage_ref ("local:..." atau "drive:<id>"). File Drive bersifat privat (tanpa link publik). */
export async function saveFile(f: { buffer: Buffer; name: string; mime: string }, folder: string): Promise<string> {
  const safe = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${f.name}`;
  if ((process.env.FILE_DRIVER || "local") === "drive") {
    const d = drive();
    const res = await d.files.create({
      requestBody: { name: `${folder}__${safe}`, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!] },
      media: { mimeType: f.mime, body: Readable.from(f.buffer) },
      fields: "id",
    });
    return `drive:${res.data.id}`;
  }
  const dir = path.join(UPLOAD_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, safe), f.buffer);
  return `local:${folder}/${safe}`;
}

export async function readFile(ref: string): Promise<Buffer> {
  if (ref.startsWith("drive:")) {
    const d = drive();
    const res = await d.files.get({ fileId: ref.slice(6), alt: "media" }, { responseType: "arraybuffer" });
    return Buffer.from(res.data as ArrayBuffer);
  }
  if (ref.startsWith("local:")) {
    const rel = ref.slice(6);
    const full = path.resolve(UPLOAD_DIR, rel);
    if (!full.startsWith(path.resolve(UPLOAD_DIR))) throw new Error("Path tidak valid");
    return fs.readFileSync(full);
  }
  throw new Error("storage_ref tidak dikenal");
}
