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
    .sort((a, b) => a.template_id.localeCompare(b.template_id));
}

export async function saveTemplate(u: SessionUser, fd: FormData, editId?: string) {
  must(u);
  const store = await getStore();
  const name = str(fd, "name");
  if (name.length < 3) throw new HttpError(400, "Nama template wajib diisi.");
  const category = str(fd, "category") || "Lainnya";
  const version = str(fd, "version") || "1.0";
  const file = fileOf(fd, "file");
  const patch: Partial<Row> = {
    name,
    category,
    version,
    description: str(fd, "description"),
    usage_info: str(fd, "usage_info"),
    updated_at: nowIso(),
    updated_by: u.name,
    is_demo: "0",
  };
  if (file) {
    const v = await validateUpload(file, "document", "File template");
    Object.assign(patch, {
      file_name: v.name,
      mime: v.mime,
      size: String(v.size),
      storage_ref: await saveFile(v, "templates", {
        title: `${name} v${version}`,
        entityId: editId || "TEMPLATE",
        uploadedBy: u.name,
      }),
    });
  }
  if (editId) {
    if (!(await store.list("TEMPLATES")).some((t) => t.template_id === editId))
      throw new HttpError(404, "Template tidak ditemukan.");
    await store.update("TEMPLATES", editId, patch);
    await logActivity(u, "UBAH_TEMPLATE", "TEMPLATE", editId, `${name} v${version}`);
  } else {
    if (!file) {
      patch.file_name = `${name.replace(/[^\w.\- ()]/g, "_")}.pdf`;
      patch.mime = "application/pdf";
      patch.size = "0";
    }
    const id = nextId("TPL", await store.list("TEMPLATES"), "template_id");
    await store.insert("TEMPLATES", [{ template_id: id, status: "Aktif", ...patch } as Row]);
    await logActivity(u, "TAMBAH_TEMPLATE", "TEMPLATE", id, `${name} v${version}`);
  }
}

export async function deleteTemplate(u: SessionUser, id: string) {
  must(u);
  const store = await getStore();
  const existing = (await store.list("TEMPLATES")).find((t) => t.template_id === id);
  if (!existing) throw new HttpError(404, "Template tidak ditemukan.");
  await store.deleteWhere("TEMPLATES", (r) => r.template_id === id);
  await logActivity(u, "HAPUS_TEMPLATE", "TEMPLATE", id, existing.name);
  return { id };
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
  const category = str(fd, "category") || "Lainnya";
  const file = fileOf(fd, "file");
  const patch: Partial<Row> = {
    title,
    category,
    description: str(fd, "description"),
    version: str(fd, "version") || "1.0",
    managed_by: str(fd, "managed_by") || "Admin GS / PAM",
    status: str(fd, "status") === "Tidak Berlaku" ? "Tidak Berlaku" : "Aktif",
    use_for_ai: str(fd, "use_for_ai") === "0" ? "0" : "1",
    is_demo: "0",
  };
  if (file) {
    const v = await validateUpload(file, "document", "File dokumen");
    Object.assign(patch, {
      file_name: v.name,
      mime: v.mime,
      size: String(v.size),
      storage_ref: await saveFile(v, "knowledge", {
        title,
        entityId: editId || "KNOWLEDGE",
        uploadedBy: u.name,
      }),
      uploaded_at: nowIso(),
    });
  }
  let id = editId || "";
  if (editId) {
    if (!(await store.list("KNOWLEDGE_DOCUMENTS")).some((d) => d.doc_id === editId))
      throw new HttpError(404, "Dokumen tidak ditemukan.");
    await store.update("KNOWLEDGE_DOCUMENTS", editId, patch);
    await logActivity(u, "UBAH_DOKUMEN_INFO", "KNOWLEDGE", editId, title);
  } else {
    id = nextId("KD", await store.list("KNOWLEDGE_DOCUMENTS"), "doc_id");
    if (!file) {
      patch.file_name = `${title.replace(/[^\w.\- ()]/g, "_")}.pdf`;
      patch.mime = "application/pdf";
      patch.size = "0";
      patch.uploaded_at = nowIso();
    }
    await store.insert("KNOWLEDGE_DOCUMENTS", [
      {
        doc_id: id,
        size: patch.size || "0",
        storage_ref: patch.storage_ref || "",
        ai_status: file ? "" : "Ringkasan Digital",
        ...patch,
      } as Row,
    ]);
    await logActivity(u, "TAMBAH_DOKUMEN_INFO", "KNOWLEDGE", id, title);
  }
  let ai = "";
  if (patch.storage_ref) {
    try {
      ai = await ingestDocument(id);
    } catch {
      ai = "Gagal indeks AI";
    }
  } else {
    ai = "Ringkasan Digital Aktif";
  }
  return { id, ai };
}

export async function deleteKnowledge(u: SessionUser, id: string) {
  must(u);
  const store = await getStore();
  const existing = (await store.list("KNOWLEDGE_DOCUMENTS")).find((d) => d.doc_id === id);
  if (!existing) throw new HttpError(404, "Dokumen tidak ditemukan.");
  await store.deleteWhere("KNOWLEDGE_DOCUMENTS", (r) => r.doc_id === id);
  await store.deleteWhere("AI_KNOWLEDGE_BASE", (r) => r.doc_id === id);
  await logActivity(u, "HAPUS_DOKUMEN_INFO", "KNOWLEDGE", id, existing.title);
  return { id };
}

export async function reindexKnowledge(u: SessionUser, id: string) {
  must(u);
  const r = await ingestDocument(id);
  await logActivity(u, "INDEKS_ULANG_AI", "KNOWLEDGE", id, r);
  return r;
}
