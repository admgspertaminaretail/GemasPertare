"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, Eye, FileSpreadsheet, FileText, History, Image as Img, Layers, Loader2, RotateCcw, Send, Upload, XCircle } from "lucide-react";
import { StatusBadge, DemoTag } from "../ui/kit";
import { Modal } from "../ui/Modal";
import { FileField } from "../ui/FileField";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDate, fmtDateTime, fmtSize } from "@/lib/format";
import { DOC_TYPE, FORWARD, STATUS } from "@/lib/constants";

type R = Record<string, any>;
const DOC_LABEL: Record<string, string> = {
  [DOC_TYPE.EXCEL]: "Excel Daftar Arsip Usul Musnah",
  [DOC_TYPE.FUPA]: "PDF Form FUPA (ditandatangani ABH)",
};

export function SubmissionDetail({ data, role }: { data: { submission: R; spbu: R; documents: R[]; photos: R[]; revisions: R[]; history: R[]; forwarding: R | null }; role: string }) {
  const router = useRouter();
  const toast = useToast();
  const { submission: s, spbu, documents, photos, revisions, history, forwarding } = data;
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [mode, setMode] = useState<null | "approve" | "revise" | "resubmit">(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [ex, setEx] = useState<File[]>([]);
  const [fu, setFu] = useState<File[]>([]);
  const [ph, setPh] = useState<File[]>([]);

  const canReview = role === "ADMIN_REGION" && s.status === STATUS.REVIEW;
  const canResubmit = role === "ADMIN_SPBU" && s.status === STATUS.REVISION;
  const pending = revisions.find((r) => !r.resubmitted_at);
  const curDocs = documents.filter((d) => d.is_current === "1"), oldDocs = documents.filter((d) => d.is_current !== "1");
  const curPh = photos.filter((d) => d.is_current === "1"), oldPh = photos.filter((d) => d.is_current !== "1");

  const close = () => { setMode(null); setNote(""); setEx([]); setFu([]); setPh([]); };
  const review = async (decision: "approve" | "revise") => {
    setBusy(true);
    try { await api(`/api/submissions/${s.submission_id}/review`, { decision, note }); toast("success", decision === "approve" ? "Pengajuan disetujui." : "Permintaan revisi dikirim ke Admin SPBU."); close(); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };
  const resubmit = async () => {
    const fd = new FormData(); fd.set("note", note);
    if (ex[0]) fd.set("excel", ex[0]);
    if (fu[0]) fd.set("fupa", fu[0]);
    ph.forEach((p) => fd.append("photos", p));
    setBusy(true);
    try { await api(`/api/submissions/${s.submission_id}/resubmit`, fd); toast("success", "Dokumen revisi diunggah dan masuk antrean review."); close(); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };

  const DocRow = ({ d, old }: { d: R; old?: boolean }) => {
    const isExcel = d.doc_type === DOC_TYPE.EXCEL;
    const Icon = isExcel ? FileSpreadsheet : FileText;
    let rowCount = 0;
    try { const m = d.meta ? JSON.parse(d.meta) : {}; rowCount = Number(m.totalRows ?? m.rows ?? 0) || 0; } catch {}
    return (
      <li className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ring-1 ${old ? "bg-slate-50 ring-slate-100" : "bg-white ring-slate-200"}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isExcel ? "bg-prtgreen" : "bg-prtred"} text-white`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-navy">
            {DOC_LABEL[d.doc_type] || d.doc_type}
            <span className="ml-1.5 rounded bg-softblue px-1.5 py-0.5 text-[10px] font-bold text-brand">{d.revision_id}</span>
            {rowCount > 0 && <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">{rowCount} baris</span>}
          </div>
          <div className="truncate text-xs text-slate-500">{d.file_name} · {fmtSize(d.size)} · {fmtDateTime(d.uploaded_at)}</div>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setPreview({ kind: "doc", id: d.doc_id, name: d.file_name, mime: d.mime })}><Eye className="h-4 w-4" />{isExcel ? "Lihat Tabel" : "Buka"}</button>
        <a className="btn-ghost btn-sm" href={`/api/files/doc/${d.doc_id}?download=1`}><Download className="h-4 w-4" />Unduh</a>
      </li>
    );
  };

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold text-navy">{s.submission_id}</h1><StatusBadge status={s.status} />{s.is_demo === "1" && <DemoTag />}{Number(s.current_revision) > 0 && <span className="chip bg-softblue text-brand ring-blue-100">Revisi terakhir: R{s.current_revision}</span>}</div>
            <p className="mt-1 text-sm text-slate-600">{s.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReview && <><button className="btn-danger" onClick={() => setMode("revise")}><RotateCcw className="h-4 w-4" />Perlu Revisi</button><button className="btn-success" onClick={() => setMode("approve")}><CheckCircle2 className="h-4 w-4" />Setujui</button></>}
            {canResubmit && <button className="btn-primary" onClick={() => setMode("resubmit")}><Upload className="h-4 w-4" />Unggah Revisi</button>}
          </div>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-slate-400">SPBU</dt><dd className="font-semibold"><Link className="text-brand hover:underline" href={`/dashboard/spbu/${spbu.spbu_id}`}>{s.spbu_name}</Link></dd></div>
          <div><dt className="text-xs text-slate-400">Kode SPBU · Region</dt><dd className="font-semibold">{s.spbu_code} · {s.region_name}</dd></div>
          <div><dt className="text-xs text-slate-400">Tanggal pengajuan</dt><dd className="font-semibold">{fmtDate(s.submission_date)}</dd></div>
          <div><dt className="text-xs text-slate-400">Diunggah</dt><dd className="font-semibold">{fmtDateTime(s.created_at)}</dd></div>
          <div><dt className="text-xs text-slate-400">Nomor FUPA Regional</dt><dd className="font-semibold">{s.fupa_number ? <span>{s.fupa_number} <span className="text-xs font-normal text-slate-400">({s.pooling_id})</span></span> : <span className="text-slate-400">Belum masuk pooling</span>}</dd></div>
          <div><dt className="text-xs text-slate-400">Nomor MEMO</dt><dd className="font-semibold">{s.memo_number ? <span>{s.memo_number} <span className="text-xs font-normal text-slate-400">({fmtDate(s.memo_date)})</span></span> : <span className="text-slate-400">Belum di-Memo</span>}</dd></div>
          {s.memo_number && <div className="sm:col-span-2"><dt className="text-xs text-slate-400">Penerusan MEMO ke PAM</dt><dd className="font-semibold">{forwarding?.status === FORWARD.YES ? `Sudah diteruskan · ${fmtDate(forwarding.forwarded_date)}` : "Belum diteruskan"}{forwarding?.notes ? <span className="font-normal text-slate-500"> — {forwarding.notes}</span> : null}</dd></div>}
        </dl>
      </section>

      {s.status === STATUS.REVISION && pending && (
        <section className="rounded-2xl bg-red-50 p-5 ring-1 ring-red-100">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-prtred" />
            <div><h2 className="font-bold text-prtred">Perlu revisi ({pending.revision_id})</h2><p className="mt-1 whitespace-pre-line text-sm text-navy">{pending.requested_note}</p><p className="mt-1 text-xs text-slate-500">Oleh {pending.requested_by_name} · {fmtDateTime(pending.requested_at)}</p>
              {canResubmit && <button className="btn-primary mt-3" onClick={() => setMode("resubmit")}><Upload className="h-4 w-4" />Unggah Revisi</button>}</div></div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-navy">Dokumen yang diunggah</h2>{oldDocs.length + oldPh.length > 0 && <button className="text-xs font-semibold text-brand hover:underline" onClick={() => setShowOld(!showOld)}>{showOld ? "Sembunyikan" : "Tampilkan"} versi sebelumnya ({oldDocs.length + oldPh.length})</button>}</div>
            <ul className="space-y-2">{curDocs.map((d) => <DocRow key={d.doc_id} d={d} />)}</ul>
            <h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold text-navy"><Img className="h-4 w-4" />Foto kondisi fisik arsip ({curPh.length})</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {curPh.map((p) => (
                <button key={p.photo_id} onClick={() => setPreview({ kind: "photo", id: p.photo_id, name: p.file_name, mime: p.mime })} className="group relative overflow-hidden rounded-xl ring-1 ring-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/photo/${p.photo_id}`} alt={p.file_name} loading="lazy" className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
                  <span className="absolute bottom-0 w-full truncate bg-navy/70 px-2 py-1 text-left text-[10px] text-white">{p.file_name}</span>
                </button>
              ))}
            </div>
            {showOld && (oldDocs.length + oldPh.length > 0) && (
              <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Versi sebelumnya (arsip riwayat)</div>
                <ul className="space-y-2">{oldDocs.map((d) => <DocRow key={d.doc_id} d={d} old />)}</ul>
                {oldPh.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{oldPh.map((p) => <button key={p.photo_id} onClick={() => setPreview({ kind: "photo", id: p.photo_id, name: p.file_name, mime: p.mime })} className="overflow-hidden rounded-lg opacity-70 ring-1 ring-slate-200">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={`/api/files/photo/${p.photo_id}`} alt={p.file_name} loading="lazy" className="aspect-[4/3] w-full object-cover" /></button>)}</div>}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold text-navy"><History className="h-5 w-5" />Riwayat revisi</h2>
            {revisions.length === 0 ? <p className="text-sm text-slate-500">Belum ada permintaan revisi.</p> : (
              <ol className="space-y-3">
                {revisions.map((r) => (
                  <li key={r.revision_id} className="rounded-xl bg-cloud p-4">
                    <div className="flex flex-wrap items-center gap-2"><span className="chip bg-red-50 text-prtred ring-red-200">{r.revision_id}</span>{r.resubmitted_at ? <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">Sudah diperbaiki</span> : <span className="chip bg-amber-50 text-amber-800 ring-amber-200">Menunggu perbaikan</span>}</div>
                    <p className="mt-2 text-sm"><b>Catatan PIC Region:</b> {r.requested_note}</p><p className="text-xs text-slate-500">{r.requested_by_name} · {fmtDateTime(pending?.revision_id === r.revision_id ? r.requested_at : r.requested_at)}</p>
                    {r.resubmitted_at && <p className="mt-2 text-sm"><b>Perbaikan SPBU:</b> {r.resubmit_note || "Dokumen revisi diunggah."} <span className="text-xs text-slate-500">· {fmtDateTime(r.resubmitted_at)}</span></p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside>
          <section className="card p-5">
            <h2 className="mb-4 font-bold text-navy">Riwayat status</h2>
            <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
              {[...history].reverse().map((h) => (
                <li key={h.history_id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brand ring-4 ring-white" />
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">{h.from_status && <><span className="text-slate-400">{h.from_status}</span><span>→</span></>}<StatusBadge status={h.to_status} /></div>
                  <p className="mt-1 text-xs text-slate-600">{h.note}</p>
                  <p className="text-[11px] text-slate-400">{h.changed_by_name} · {fmtDateTime(h.changed_at)}</p>
                </li>
              ))}
            </ol>
          </section>
          {s.fupa_number && <div className="card mt-5 flex items-center gap-3 p-4"><Layers className="h-6 w-6 text-brand" /><div className="text-sm"><div className="font-bold text-navy">{s.fupa_number}</div><div className="text-xs text-slate-500">Pooling {s.pooling_id}{s.memo_number ? ` · ${s.memo_number}` : ""}</div></div></div>}
        </aside>
      </div>

      <FilePreview target={preview} onClose={() => setPreview(null)} />

      <Modal open={mode === "approve" || mode === "revise"} onClose={close} title={mode === "approve" ? "Setujui pengajuan" : "Minta revisi"}
        footer={<><button className="btn-ghost" onClick={close} disabled={busy}>Batal</button>{mode === "approve" ? <button className="btn-success" onClick={() => review("approve")} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Setujui</button> : <button className="btn-danger" onClick={() => review("revise")} disabled={busy || note.trim().length < 5}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}Kirim Permintaan Revisi</button>}</>}>
        <p className="mb-3 text-sm text-slate-600">{mode === "approve" ? "Pengajuan akan berstatus “Disetujui” dan siap di-pooling." : "Admin SPBU akan melihat catatan ini di dashboard dan diminta mengunggah dokumen perbaikan."}</p>
        <label className="label" htmlFor="nt">{mode === "approve" ? "Catatan (opsional)" : "Catatan revisi *"}</label>
        <textarea id="nt" className="input min-h-[110px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "revise" ? "Jelaskan bagian yang perlu diperbaiki…" : ""} />
      </Modal>

      <Modal open={mode === "resubmit"} wide onClose={close} title={`Unggah revisi — ${pending?.revision_id || ""}`}
        footer={<><button className="btn-ghost" onClick={close} disabled={busy}>Batal</button><button className="btn-primary" onClick={resubmit} disabled={busy || (!ex.length && !fu.length && !ph.length)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Kirim Revisi</button></>}>
        {pending && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm"><b className="text-prtred">Catatan PIC Region:</b> {pending.requested_note}</div>}
        <p className="mb-3 text-xs text-slate-500">Unggah hanya dokumen yang diperbaiki. Dokumen lain tetap memakai versi terakhir. Dokumen lama tetap tersimpan dalam riwayat.</p>
        <div className="space-y-3">
          <FileField kind="excel" required={false} label="Excel Daftar Arsip (perbaikan)" accept=".xlsx" files={ex} onChange={setEx} />
          <FileField kind="pdf" required={false} label="PDF Form FUPA (perbaikan)" accept=".pdf" files={fu} onChange={setFu} />
          <FileField kind="image" required={false} label="Foto kondisi arsip (mengganti set foto sebelumnya)" accept=".jpg,.jpeg,.png" multiple files={ph} onChange={setPh} />
          <div><label className="label" htmlFor="rn">Catatan perbaikan</label><textarea id="rn" className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
}
