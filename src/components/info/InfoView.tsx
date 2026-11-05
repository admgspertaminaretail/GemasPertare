"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, FileText, Loader2, Pencil, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { Empty } from "../ui/kit";
import { Modal } from "../ui/Modal";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDate, fmtSize } from "@/lib/format";
import { KNOWLEDGE_CATEGORIES } from "@/lib/constants";

type Doc = Record<string, string>;
const blank = { title: "", category: KNOWLEDGE_CATEGORIES[0], description: "", version: "", managed_by: "Admin PAM", status: "Aktif", use_for_ai: "1" };

export function InfoView({ docs, canManage }: { docs: Doc[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [edit, setEdit] = useState<{ id?: string; form: typeof blank } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => [...new Set(docs.map((d) => d.category))], [docs]);
  const list = docs.filter((d) => (!cat || d.category === cat) && (!q || (d.title + " " + d.description + " " + d.category).toLowerCase().includes(q.toLowerCase())));

  const save = async () => {
    if (!edit) return;
    const fd = new FormData();
    fd.set("action", edit.id ? "update" : "create");
    if (edit.id) fd.set("id", edit.id);
    Object.entries(edit.form).forEach(([k, v]) => fd.set(k, v));
    if (file) fd.set("file", file);
    setBusy(true);
    try {
      const r = await api("/api/knowledge", fd);
      toast("success", `Dokumen disimpan. Status AI: ${r.ai}`);
      setEdit(null); setFile(null); router.refresh();
    } catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };
  const reindex = async (id: string) => {
    setBusy(true);
    const f = new FormData(); f.set("action", "reindex"); f.set("id", id);
    try { const r = await api("/api/knowledge", f); toast("success", `Status AI: ${r.ai}`); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Cari dokumen…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari dokumen" /></div>
        <div className="flex flex-wrap gap-1.5">
          {["", ...cats].map((c) => (
            <button key={c || "all"} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${cat === c ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"}`}>{c || "Semua"}</button>
          ))}
        </div>
        {canManage && <button className="btn-primary" onClick={() => { setEdit({ form: { ...blank } }); setFile(null); }}><Plus className="h-4 w-4" />Tambah Dokumen</button>}
      </div>

      {list.length === 0 ? <div className="card"><Empty title="Dokumen tidak ditemukan" text="Ubah kata kunci atau kategori." /></div> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const has = !!d.storage_ref;
            return (
              <article key={d.doc_id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${has ? "bg-brand text-white" : "bg-slate-100 text-slate-400"}`}><FileText className="h-6 w-6" /></div>
                  <div className="min-w-0">
                    <h3 className="font-bold leading-snug text-navy">{d.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="chip bg-softblue text-brand ring-blue-100">{d.category}</span>
                      <span className={`chip ${d.status === "Aktif" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{d.status}</span>
                    </div>
                  </div>
                </div>
                {d.description && <p className="mt-3 text-sm text-slate-600">{d.description}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-400">Versi</dt><dd className="font-semibold">{d.version || "-"}</dd>
                  <dt className="text-slate-400">Tanggal upload</dt><dd className="font-semibold">{fmtDate(d.uploaded_at)}</dd>
                  <dt className="text-slate-400">Pengelola</dt><dd className="font-semibold">{d.managed_by || "-"}</dd>
                  {has && <><dt className="text-slate-400">File</dt><dd className="truncate font-semibold" title={d.file_name}>{fmtSize(d.size)}</dd></>}
                </dl>
                {canManage && <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-cloud px-2.5 py-1.5 text-[11px] text-slate-600"><Sparkles className="h-3.5 w-3.5 text-brand" />Basis AI: {d.use_for_ai === "1" ? d.ai_status || "-" : "Tidak dipakai"}</div>}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  {has ? (
                    <>
                      <button className="btn-ghost btn-sm" onClick={() => setPreview({ kind: "knowledge", id: d.doc_id, name: d.file_name, mime: d.mime })}><Eye className="h-4 w-4" />Preview</button>
                      <a className="btn-primary btn-sm" href={`/api/files/knowledge/${d.doc_id}?download=1`}><Download className="h-4 w-4" />Download</a>
                    </>
                  ) : <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">File belum diunggah oleh Admin PAM</span>}
                  {canManage && <>
                    <button className="btn-ghost btn-sm" onClick={() => { setEdit({ id: d.doc_id, form: { title: d.title, category: d.category, description: d.description, version: d.version, managed_by: d.managed_by, status: d.status, use_for_ai: d.use_for_ai || "1" } }); setFile(null); }}><Pencil className="h-4 w-4" />{has ? "Ubah" : "Unggah"}</button>
                    {has && <button className="btn-ghost btn-sm" disabled={busy} onClick={() => reindex(d.doc_id)} title="Indeks ulang untuk AI"><RefreshCw className="h-4 w-4" /></button>}
                  </>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FilePreview target={preview} onClose={() => setPreview(null)} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah Dokumen" : "Tambah Dokumen"} footer={<><button className="btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button><button className="btn-primary" onClick={save} disabled={busy || !edit?.form.title}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan</button></>}>
        {edit && (
          <div className="space-y-3">
            <div><label className="label">Judul *</label><input className="input" value={edit.form.title} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, title: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Kategori</label><select className="input" value={edit.form.category} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, category: e.target.value } })}>{KNOWLEDGE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Versi</label><input className="input" placeholder="mis. 2.0" value={edit.form.version} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, version: e.target.value } })} /></div>
              <div><label className="label">Status</label><select className="input" value={edit.form.status} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, status: e.target.value } })}><option>Aktif</option><option>Tidak Berlaku</option></select></div>
              <div><label className="label">Pengelola</label><input className="input" value={edit.form.managed_by} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, managed_by: e.target.value } })} /></div>
            </div>
            <div><label className="label">Deskripsi</label><textarea className="input min-h-[70px]" value={edit.form.description} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, description: e.target.value } })} /></div>
            <div><label className="label">File (PDF/Excel/Word){edit.id ? " — kosongkan jika tidak diganti" : " *"}</label><input type="file" accept=".pdf,.xlsx,.docx" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={edit.form.use_for_ai === "1"} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, use_for_ai: e.target.checked ? "1" : "0" } })} /><span>Jadikan sumber pengetahuan <b>Tanya si GEMAS</b> (hanya PDF yang berisi teks yang dapat diindeks).</span></label>
          </div>
        )}
      </Modal>
    </div>
  );
}
