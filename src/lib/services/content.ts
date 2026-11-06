import { getStore } from "../db";
import { SessionUser, HttpError } from "../auth";
import { Row } from "../schema";
import { logActivity, nowIso, nextId } from "./core";
import { saveFile, validateUpload } from "../storage";
import { ingestDocument } from "./rag";
import { KNOWLEDGE_CATEGORIES, TEMPLATE_CATEGORIES } from "../constants";

const must = (u: SessionUser) => { if (u.role !== "ADMIN_PAM") throw new HttpError(403, "Hanya Admin PAM yang dapat mengelola konten."); };
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const fileOf = (fd: FormData, k: string) => { const f = fd.get(k); return f && typeof f !== "string" && (f as File).size > 0 ? (f as File) : null; };

/* ---------------------------------------------------------------- Template */
export async function listTemplates(u: SessionUser) {
  const store = await getStore();
  const rows = await store.list("TEMPLATES");
  return rows
    .filter((t) => u.role === "ADMIN_PAM" || t.status === "Aktif")
    .filter((t) => (u.role === "ADMIN_SPBU" ? t.category === "Daftar Arsip" : true))
    .sort((a, b) => a.template_id.localeCompare(b.template_id));
}

export async function saveTemplate(u: SessionUser, fd: FormData, editId?: string) {
  must(u);
  const store = await getStore();
  const name = str(fd, "name");
  if (name.length < 3) throw new HttpError(400, "Nama template wajib diisi.");
  const category = str(fd, "category");
  if (!TEMPLATE_CATEGORIES.includes(category)) throw new HttpError(400, "Kategori tidak valid.");
  const version = str(fd, "version");
  if (!version) throw new HttpError(400, "Versi template wajib diisi.");
  const file = fileOf(fd, "file");
  if (!editId && !file) throw new HttpError(400, "File template wajib diunggah.");
  const patch: Partial<Row> = { name, category, version, description: str(fd, "description"), usage_info: str(fd, "usage_info"), updated_at: nowIso(), updated_by: u.name, is_demo: "0" };
  if (file) {
    const v = await validateUpload(file, "document", "File template");
    Object.assign(patch, { file_name: v.name, mime: v.mime, size: String(v.size), storage_ref: await saveFile(v, "templates", { title: `${name} v${version}`, entityId: editId || "TEMPLATE", uploadedBy: u.name }) });
  }
  if (editId) {
    if (!(await store.list("TEMPLATES")).some((t) => t.template_id === editId)) throw new HttpError(404, "Template tidak ditemukan.");
    await store.update("TEMPLATES", editId, patch);
    await logActivity(u, "UBAH_TEMPLATE", "TEMPLATE", editId, `${name} v${version}`);
  } else {
    const id = nextId("TPL", await store.list("TEMPLATES"), "template_id");
    await store.insert("TEMPLATES", [{ template_id: id, status: "Aktif", ...patch } as Row]);
    await logActivity(u, "TAMBAH_TEMPLATE", "TEMPLATE", id, `${name} v${version}`);
  }
}

export async function setTemplateActive(u: SessionUser, id: string, active: boolean) {
  must(u);
  const store = await getStore();
  if (!(await store.list("TEMPLATES")).some((t) => t.template_id === id)) throw new HttpError(404, "Template tidak ditemukan.");
  await store.update("TEMPLATES", id, { status: active ? "Aktif" : "Nonaktif", updated_at: nowIso(), updated_by: u.name });
  await logActivity(u, active ? "AKTIFKAN_TEMPLATE" : "NONAKTIFKAN_TEMPLATE", "TEMPLATE", id);
}

/* ------------------------------------------------------- Pusat Informasi */
export async function listKnowledge(u: SessionUser) {
  const store = await getStore();
  const rows = await store.list("KNOWLEDGE_DOCUMENTS");
  for (const r of rows) {
    if (r.category === "Materi Sprint") {
      const patch: Partial<Row> = { category: "Sprint (Surat Perintah)" };
      if (r.title === "Materi Sprint Tim Arsip") {
        patch.title = "Sprint (Surat Perintah) Pengelolaan Arsip";
        patch.description = "Surat perintah resmi terkait pengelolaan dan pemusnahan arsip.";
      }
      try {
        await store.update("KNOWLEDGE_DOCUMENTS", r.doc_id, patch);
        Object.assign(r, patch);
      } catch {
        Object.assign(r, patch);
      }
    }
  }
  return rows.sort((a, b) => a.doc_id.localeCompare(b.doc_id)).map((r) => (u.role === "ADMIN_PAM" ? r : { ...r, ai_status: "" }));
}

export async function saveKnowledge(u: SessionUser, fd: FormData, editId?: string) {
  must(u);
  const store = await getStore();
  const title = str(fd, "title");
  if (title.length < 3) throw new HttpError(400, "Judul dokumen wajib diisi.");
  const category = str(fd, "category");
  if (!KNOWLEDGE_CATEGORIES.includes(category)) throw new HttpError(400, "Kategori tidak valid.");
  const file = fileOf(fd, "file");
  const patch: Partial<Row> = {
    title, category, description: str(fd, "description"), version: str(fd, "version"), managed_by: str(fd, "managed_by") || "Admin PAM",
    status: str(fd, "status") === "Tidak Berlaku" ? "Tidak Berlaku" : "Aktif", use_for_ai: str(fd, "use_for_ai") === "0" ? "0" : "1", is_demo: "0",
  };
  if (file) {
    const v = await validateUpload(file, "document", "File dokumen");
    Object.assign(patch, { file_name: v.name, mime: v.mime, size: String(v.size), storage_ref: await saveFile(v, "knowledge", { title, entityId: editId || "KNOWLEDGE", uploadedBy: u.name }), uploaded_at: nowIso() });
  }
  let id = editId || "";
  if (editId) {
    if (!(await store.list("KNOWLEDGE_DOCUMENTS")).some((d) => d.doc_id === editId)) throw new HttpError(404, "Dokumen tidak ditemukan.");
    await store.update("KNOWLEDGE_DOCUMENTS", editId, patch);
    await logActivity(u, "UBAH_DOKUMEN_INFO", "KNOWLEDGE", editId, title);
  } else {
    if (!file) throw new HttpError(400, "File dokumen wajib diunggah.");
    id = nextId("KD", await store.list("KNOWLEDGE_DOCUMENTS"), "doc_id");
    await store.insert("KNOWLEDGE_DOCUMENTS", [{ doc_id: id, size: "0", storage_ref: "", ai_status: "", ...patch } as Row]);
    await logActivity(u, "TAMBAH_DOKUMEN_INFO", "KNOWLEDGE", id, title);
  }
  const ai = await ingestDocument(id);
  return { id, ai };
}

export async function reindexKnowledge(u: SessionUser, id: string) {
  must(u);
  const r = await ingestDocument(id);
  await logActivity(u, "INDEKS_ULANG_AI", "KNOWLEDGE", id, r);
  return r;
}
