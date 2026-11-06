"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, Eye, FileSpreadsheet, FileText, Info, Loader2, Pencil, Plus, Power } from "lucide-react";
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
  const [file, setFile] = useState<File | null>(null);
  const [toggle, setToggle] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleRows = rows.filter((r) => r.category !== "Data i-BOS");
  const list = visibleRows.filter((r) => !cat || r.category === cat);

  const run = async (fd: FormData, ok: string, after: () => void) => {
    setBusy(true);
    try { await api("/api/templates", fd); toast("success", ok); after(); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };
  const save = () => {
    if (!edit) return;
    const fd = new FormData();
    fd.set("action", edit.id ? "update" : "create"); if (edit.id) fd.set("id", edit.id);
    Object.entries(edit.form).forEach(([k, v]) => fd.set(k, v));
    if (file) fd.set("file", file);
    run(fd, "Template disimpan.", () => { setEdit(null); setFile(null); });
  };
  const doToggle = () => {
    if (!toggle) return;
    const fd = new FormData(); fd.set("action", "toggle"); fd.set("id", toggle.template_id); fd.set("active", toggle.status === "Aktif" ? "0" : "1");
    run(fd, toggle.status === "Aktif" ? "Template dinonaktifkan." : "Template diaktifkan.", () => setToggle(null));
  };

  return (
    <div className="space-y-4">
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
        {["", ...VISIBLE_CATEGORIES.filter((c) => visibleRows.some((r) => r.category === c))].map((c) => (
          <button key={c || "all"} onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${cat === c ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"}`}>{c || "Semua kategori"}</button>
        ))}
        <div className="flex-1" />
        {canManage && <button className="btn-primary" onClick={() => { setEdit({ form: { ...blank } }); setFile(null); }}><Plus className="h-4 w-4" />Tambah Template</button>}
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
                      <span className={`chip ${t.status === "Aktif" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{t.status}</span>
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
                    <button className="btn-ghost btn-sm" onClick={() => { setEdit({ id: t.template_id, form: { name: t.name, category: t.category, version: t.version, description: t.description, usage_info: t.usage_info } }); setFile(null); }}><Pencil className="h-4 w-4" />Ubah</button>
                    <button className="btn-ghost btn-sm" onClick={() => setToggle(t)}><Power className="h-4 w-4" />{t.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}</button>
                  </>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FilePreview target={preview} onClose={() => setPreview(null)} />
      <ConfirmModal open={!!toggle} onClose={() => setToggle(null)} busy={busy} onConfirm={doToggle} danger={toggle?.status === "Aktif"} title={toggle?.status === "Aktif" ? "Nonaktifkan template?" : "Aktifkan template?"} message={toggle?.status === "Aktif" ? "Template tidak akan terlihat dan tidak dapat diunduh oleh Admin SPBU/Region." : "Template akan kembali dapat diunduh pengguna."} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Ubah Template" : "Tambah Template"} footer={<><button className="btn-ghost" onClick={() => setEdit(null)} disabled={busy}>Batal</button><button className="btn-primary" onClick={save} disabled={busy || !edit?.form.name || !edit?.form.version}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan</button></>}>
        {edit && (
          <div className="space-y-3">
            <div><label className="label">Nama template *</label><input className="input" value={edit.form.name} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, name: e.target.value } })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Kategori</label><select className="input" value={edit.form.category} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, category: e.target.value } })}>{VISIBLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Versi *</label><input className="input" placeholder="mis. 1.0" value={edit.form.version} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, version: e.target.value } })} /></div>
            </div>
            <div><label className="label">Deskripsi</label><textarea className="input min-h-[60px]" value={edit.form.description} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, description: e.target.value } })} /></div>
            <div><label className="label">Informasi penggunaan</label><textarea className="input min-h-[60px]" value={edit.form.usage_info} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, usage_info: e.target.value } })} /></div>
            <div><label className="label">File (PDF/Excel/Word){edit.id ? " — kosongkan jika tidak diganti" : " *"}</label><input type="file" accept=".pdf,.xlsx,.docx" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
