"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, Eye, FileSpreadsheet, FileText, Info, Loader2, Pencil, Plus, Power, Sparkles, Trash2 } from "lucide-react";
import { Empty, DemoTag } from "../ui/kit";
import { Modal, ConfirmModal } from "../ui/Modal";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDate } from "@/lib/format";
import { TEMPLATE_CATEGORIES } from "@/lib/constants";

type T = Record<string, string>;
const VISIBLE_CATEGORIES = TEMPLATE_CATEGORIES.filter((c) => c !== "Data i-BOS");
const blank = { name: "", category: VISIBLE_CATEGORIES[0] || "Form FUPA", version: "", description: "", usage_info: "" };

export function TemplatesView({ rows, canManage }: { rows: T[]; canManage: boolean; role?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [cat, setCat] = useState("");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [edit, setEdit] = useState<{ id?: string; form: typeof blank } | null>(null);
  const [isCustomCat, setIsCustomCat] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [toggle, setToggle] = useState<T | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleRows = rows.filter((r) => r.category !== "Data i-BOS");
  const list = visibleRows.filter((r) => !cat || r.category === cat);

  const allCategories = Array.from(
    new Set([...VISIBLE_CATEGORIES, ...visibleRows.map((r) => r.category).filter(Boolean)])
  );

  const run = async (fd: FormData, ok: string, after: () => void) => {
    setBusy(true);
    try { await api("/api/templates", fd); toast("success", ok); after(); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };
  const save = () => {
    if (!edit) return;
    const finalCategory = isCustomCat && customCategory.trim() ? customCategory.trim() : edit.form.category;
    if (!finalCategory) {
      toast("error", "Kategori template wajib diisi.");
      return;
    }
    const fd = new FormData();
    fd.set("action", edit.id ? "update" : "create");
    if (edit.id) fd.set("id", edit.id);
    Object.entries(edit.form).forEach(([k, v]) => fd.set(k, v));
    fd.set("category", finalCategory);
    if (file) fd.set("file", file);
    run(fd, `Template "${edit.form.name}" berhasil disimpan.`, () => {
      setEdit(null);
      setFile(null);
      setIsCustomCat(false);
      setCustomCategory("");
    });
  };
  const doToggle = () => {
    if (!toggle) return;
    const fd = new FormData(); fd.set("action", "toggle"); fd.set("id", toggle.template_id); fd.set("active", toggle.status === "Aktif" ? "0" : "1");
    run(fd, toggle.status === "Aktif" ? "Template dinonaktifkan." : "Template diaktifkan.", () => setToggle(null));
  };
  const doDelete = () => {
    if (!toDelete) return;
    const fd = new FormData();
    fd.set("action", "delete");
    fd.set("id", toDelete.template_id);
    run(fd, `Template "${toDelete.name}" berhasil dihapus.`, () => setToDelete(null));
  };

  const openAdd = () => {
    setEdit({ form: { ...blank } });
    setIsCustomCat(false);
    setCustomCategory("");
    setFile(null);
  };

  return (
    <div className="space-y-4">
      {/* BANNER KHUSUS HAK AKSES ADMIN GS */}
      {canManage && (
        <div className="card flex flex-wrap items-center justify-between gap-4 border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-teal-50/40 to-white p-4.5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-prtgreen text-white shadow-sm ring-2 ring-emerald-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-navy">Hak Akses Admin GS — Pengelolaan Pusat Template</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Akses Aktif
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Tambah template formulir baru (.pdf / .xlsx), perbarui berkas resmi, nonaktifkan, atau hapus template.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary flex items-center gap-2 shadow-sm"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Template Baru</span>
          </button>
        </div>
      )}

      <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-prtgreen p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-prtgreen ring-1 ring-emerald-200">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-navy">Mencari Data Arsip Tarikan i-BOS Bulanan?</div>
            <p className="text-xs text-slate-500">
              Data tarikan arsip per bulan dari sistem i-BOS yang diunggah Admin GS kini tersedia di menu khusus <b>Data Arsip Tarikan i-BOS</b>.
            </p>
          </div>
        </div>
        <Link href="/tarikan-ibos" className="btn-ghost btn-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100">
          Buka Data Arsip Tarikan i-BOS
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        {["", ...allCategories.filter((c) => visibleRows.some((r) => r.category === c))].map((c) => (
          <button key={c || "all"} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${cat === c ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"}`}>{c || "Semua kategori"}</button>
        ))}
        <div className="flex-1" />
        {canManage && <button className="btn-primary" onClick={openAdd}><Plus className="h-4 w-4" />Tambah Template</button>}
      </div>

      {list.length === 0 ? <div className="card"><Empty title="Belum ada template" /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => {
            const xl = t.file_name.toLowerCase().endsWith(".xlsx");
            return (
              <article key={t.template_id} className={`card flex flex-col p-5 ${t.status !== "Aktif" ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white ${xl ? "bg-prtgreen" : "bg-prtred"}`}>{xl ? <FileSpreadsheet className="h-6 w-6" /> : <FileText className="h-6 w-6" />}</div>
                  <div className="min-w-0">
                    <h3 className="font-bold leading-snug text-navy">{t.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="chip bg-softblue text-brand ring-blue-100">{t.category}</span>
                      {t.status && t.status !== "Aktif" && (
                        <span className="chip bg-slate-100 text-slate-500 ring-slate-200">{t.status}</span>
                      )}
                      {t.is_demo === "1" && <DemoTag />}
                    </div>
                  </div>
                </div>
                {t.description && <p className="mt-3 text-sm text-slate-600">{t.description}</p>}
                {t.usage_info && <div className="mt-3 flex gap-2 rounded-xl bg-softblue/70 p-3 text-xs text-navy"><Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span><b>Cara pakai:</b> {t.usage_info}</span></div>}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><dt className="text-slate-400">Versi</dt><dd className="font-semibold">{t.version}</dd><dt className="text-slate-400">Diperbarui</dt><dd className="font-semibold">{fmtDate(t.updated_at)}</dd></dl>
                {t.is_demo === "1" && <p className="mt-2 text-[11px] text-amber-700">Berkas placeholder — Admin PAM perlu mengunggah template resmi.</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button className="btn-ghost btn-sm" onClick={() => setPreview({ kind: "template", id: t.template_id, name: t.file_name, mime: t.mime })}><Eye className="h-4 w-4" />Preview</button>
                  <a className="btn-primary btn-sm" href={`/api/files/template/${t.template_id}?download=1`}><Download className="h-4 w-4" />Download</a>
                  {canManage && <>
                    <button className="btn-ghost btn-sm" onClick={() => {
                      const isKnown = VISIBLE_CATEGORIES.includes(t.category);
                      setEdit({ id: t.template_id, form: { name: t.name, category: isKnown ? t.category : VISIBLE_CATEGORIES[0], version: t.version, description: t.description, usage_info: t.usage_info } });
                      setIsCustomCat(!isKnown);
                      setCustomCategory(!isKnown ? t.category : "");
                      setFile(null);
                    }}><Pencil className="h-4 w-4" />Ubah</button>
                    <button className="btn-ghost btn-sm" onClick={() => setToggle(t)}><Power className="h-4 w-4" />{t.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}</button>
                    <button type="button" className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 ring-1 ring-rose-200" onClick={() => setToDelete(t)} title="Hapus template"><Trash2 className="h-4 w-4" />Hapus</button>
                  </>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FilePreview target={preview} onClose={() => setPreview(null)} />
      <ConfirmModal open={!!toggle} onClose={() => setToggle(null)} busy={busy} onConfirm={doToggle} danger={toggle?.status === "Aktif"} title={toggle?.status === "Aktif" ? "Nonaktifkan template?" : "Aktifkan template?"} message={toggle?.status === "Aktif" ? "Template tidak akan terlihat dan tidak dapat diunduh oleh Admin SPBU/Region." : "Template akan kembali dapat diunduh pengguna."} />
      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} busy={busy} onConfirm={doDelete} danger confirmLabel="Ya, Hapus Template" title="Hapus Template?" message={`Template "${toDelete?.name || ""}" akan dihapus permanen dari Pusat Template.`} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah Template" : "Tambah Template"} footer={<><button className="btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button><button className="btn-primary" onClick={save} disabled={busy || !edit?.form.name || !edit?.form.version || (isCustomCat && !customCategory.trim())}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan</button></>}>
        {edit && (
          <div className="space-y-3">
            <div><label className="label">Nama template *</label><input className="input" placeholder="mis. Template Form Berita Acara" value={edit.form.name} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, name: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Kategori *</label>
                <select
                  className="input"
                  value={isCustomCat ? "__custom__" : edit.form.category}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustomCat(true);
                    } else {
                      setIsCustomCat(false);
                      setEdit({ ...edit, form: { ...edit.form, category: e.target.value } });
                    }
                  }}
                >
                  {VISIBLE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Kategori Baru (Kustom)...</option>
                </select>
                {isCustomCat && (
                  <input
                    className="input mt-2 border-brand focus:ring-brand"
                    placeholder="Ketik kategori baru (mis. Berita Acara)..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    required
                  />
                )}
              </div>
              <div><label className="label">Versi *</label><input className="input" placeholder="mis. 1.0 atau 2026" value={edit.form.version} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, version: e.target.value } })} /></div>
            </div>
            <div><label className="label">Deskripsi</label><textarea className="input min-h-[60px]" placeholder="Penjelasan isi template..." value={edit.form.description} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, description: e.target.value } })} /></div>
            <div><label className="label">Informasi penggunaan</label><textarea className="input min-h-[60px]" placeholder="Petunjuk cara pengisian template..." value={edit.form.usage_info} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, usage_info: e.target.value } })} /></div>
            <div>
              <label className="label">File Dokumen (PDF/Excel/Word) — <span className="font-normal text-slate-500">Opsional</span></label>
              <input type="file" accept=".pdf,.xlsx,.docx" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <p className="mt-1 text-[11px] text-slate-500">
                Bisa disimpan tanpa berkas (otomatis disiapkan placeholder dokumen resmi), atau unggah berkas Anda.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
