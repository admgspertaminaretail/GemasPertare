"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Calendar, CalendarCheck, ChevronDown, ChevronUp, Download, Eye, FileSpreadsheet, Layers, Loader2, Send } from "lucide-react";
import type { IbosExtractItem } from "@/lib/services/ibos";
import { SubmissionTable } from "./SubmissionTable";
import { MonthlyIbosModal } from "./MonthlyIbosModal";
import { DataTable } from "../ui/DataTable";
import { Empty, StatusBadge } from "../ui/kit";
import { ConfirmModal, Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDate, fmtPeriod, todayStr } from "@/lib/format";
import { FORWARD } from "@/lib/constants";

type R = Record<string, any>;
type TemplateShortcut = { id: string; name: string; version: string } | null;

export function SubmissionsHub({
  role,
  tab: initial,
  subs,
  poolings,
  memos,
  poolable,
  memoable,
  ibosItems = [],
  daftarArsipTemplate,
  fupaTemplate,
}: {
  role: string;
  tab: string;
  subs: R[];
  poolings: R[];
  memos: R[];
  poolable: R[];
  memoable: R[];
  ibosItems?: IbosExtractItem[];
  daftarArsipTemplate?: TemplateShortcut;
  fupaTemplate?: TemplateShortcut;
}) {
  const [tab, setTab] = useState(initial);
  const [openIbos, setOpenIbos] = useState(false);
  const latestIbos = ibosItems[0] || null;
  useEffect(() => { setTab(initial); }, [initial]);
  const isRegion = role === "ADMIN_REGION";
  const tabs = role === "ADMIN_SPBU" ? [] : [
    { id: "pengajuan", label: "Pengajuan", n: subs.length },
    { id: "pooling", label: "Pooling FUPA", n: poolings.filter((p) => p.status === "AKTIF").length },
    { id: "memo", label: "MEMO", n: memos.length },
  ];

  return (
    <div className="space-y-4">
      {tabs.length > 0 && (
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-slate-100" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === t.id ? "bg-brand text-white shadow-card" : "text-navy hover:bg-softblue"}`}>
              {t.label}<span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === t.id ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{t.n}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "pengajuan" && (
        <>
          <div className="card flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-brand p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand ring-1 ring-blue-100">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-navy">Data Arsip Tarikan i-BOS</span>
                  {latestIbos && (
                    <span className="rounded-full bg-softblue px-2.5 py-0.5 text-[10px] font-bold text-brand ring-1 ring-blue-200">
                      Periode {fmtPeriod(latestIbos.period)}
                    </span>
                  )}
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    Update Back Office
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Data acuan bulanan resmi dari Admin GS. Klik unduh langsung untuk acuan menyusun <b>Template Daftar Arsip Usul Musnah</b>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {latestIbos ? (
                <>
                  <a
                    href={`/api/files/ibos/${latestIbos.extract_id}?download=1`}
                    className="btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                    title={`Unduh ${latestIbos.file_name} (${latestIbos.title})`}
                  >
                    <Download className="h-4 w-4" />
                    Download Tarikan i-BOS ({fmtPeriod(latestIbos.period)})
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpenIbos(true)}
                    className="btn-ghost btn-sm ring-1 ring-slate-200"
                    title="Tinjau isi data sebelum unduh"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                </>
              ) : (
                <button type="button" disabled className="btn-ghost btn-sm opacity-50">
                  <Download className="h-4 w-4" />
                  Tarikan i-BOS Belum Tersedia
                </button>
              )}
              {daftarArsipTemplate && (
                <a
                  href={`/api/files/template/${daftarArsipTemplate.id}?download=1`}
                  className="btn-ghost btn-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4 text-prtgreen" />
                  Template Daftar Arsip (.xlsx)
                </a>
              )}
              {fupaTemplate && (
                <a
                  href={`/api/files/template/${fupaTemplate.id}?download=1`}
                  className="btn-ghost btn-sm bg-rose-50 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
                  title="Unduh Template Form FUPA (.pdf)"
                >
                  <Download className="h-4 w-4 text-prtred" />
                  Template Form FUPA (.pdf)
                </a>
              )}
            </div>
          </div>

          <SubmissionTable
            rows={subs}
            showSpbu={role !== "ADMIN_SPBU"}
            showRegion={role === "ADMIN_PAM"}
            emptyText={role === "ADMIN_SPBU" ? "Klik “Buat Pengajuan Usul Musnah” untuk memulai." : undefined}
          />

          <MonthlyIbosModal open={openIbos} onClose={() => setOpenIbos(false)} items={ibosItems} />
        </>
      )}
      {tab === "pooling" && <PoolingTab canEdit={isRegion} poolings={poolings} poolable={poolable} />}
      {tab === "memo" && <MemoTab canEdit={isRegion} memos={memos} memoable={memoable} />}
    </div>
  );
}

/* ----------------------------------------------------------------- Pooling */
function PoolingTab({ canEdit, poolings, poolable }: { canEdit: boolean; poolings: R[]; poolable: R[] }) {
  const router = useRouter();
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const [fupa, setFupa] = useState("");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [cancel, setCancel] = useState<R | null>(null);
  const [reason, setReason] = useState("");

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const create = async () => {
    setBusy(true);
    try {
      await api("/api/poolings", { fupa_number: fupa, pooling_date: date, submission_ids: sel, notes });
      toast("success", `Pooling dibuat dengan ${sel.length} pengajuan.`);
      setSel([]); setFupa(""); setNotes(""); setConfirm(false); router.refresh();
    } catch (e: any) { toast("error", e.message); setConfirm(false); } finally { setBusy(false); }
  };
  const doCancel = async () => {
    if (!cancel) return;
    setBusy(true);
    try { await api(`/api/poolings/${cancel.pooling_id}/cancel`, { reason }); toast("success", "Pooling dibatalkan; pengajuan kembali berstatus Disetujui."); setCancel(null); setReason(""); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };

  const spbuSel = new Set(poolable.filter((s) => sel.includes(s.submission_id)).map((s) => s.spbu_id)).size;
  return (
    <div className="space-y-5">
      {canEdit && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
            <div><h2 className="font-bold text-navy">Buat Pooling FUPA Regional</h2><p className="text-xs text-slate-500">Pilih pengajuan berstatus <b>Disetujui</b> yang akan digabung ke satu nomor FUPA Regional.</p></div>
            <span className="chip bg-softblue text-brand ring-blue-100">{poolable.length} siap pooling</span>
          </div>
          {poolable.length === 0 ? <Empty title="Belum ada pengajuan yang siap di-pooling" text="Pengajuan akan muncul di sini setelah Anda menyetujuinya pada tahap review." /> : (
            <div className="scroll-thin max-h-[360px] overflow-auto">
              <table className="w-full min-w-[560px]">
                <thead className="sticky top-0"><tr>
                  <th className="th w-10"><input type="checkbox" aria-label="Pilih semua" checked={sel.length === poolable.length} onChange={(e) => setSel(e.target.checked ? poolable.map((p) => p.submission_id) : [])} /></th>
                  <th className="th">ID</th><th className="th">SPBU</th><th className="th">Tanggal</th><th className="th">Revisi</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {poolable.map((s) => (
                    <tr key={s.submission_id} className={`cursor-pointer hover:bg-softblue/40 ${sel.includes(s.submission_id) ? "bg-softblue/60" : ""}`} onClick={() => toggle(s.submission_id)}>
                      <td className="td"><input type="checkbox" aria-label={`Pilih ${s.submission_id}`} checked={sel.includes(s.submission_id)} onChange={() => toggle(s.submission_id)} onClick={(e) => e.stopPropagation()} /></td>
                      <td className="td font-semibold"><Link href={`/submissions/${s.submission_id}`} className="text-brand hover:underline" onClick={(e) => e.stopPropagation()}>{s.submission_id}</Link></td>
                      <td className="td">{s.spbu_name}</td><td className="td">{fmtDate(s.submission_date)}</td><td className="td">{Number(s.current_revision) ? `R${s.current_revision}` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid gap-3 border-t border-slate-100 bg-cloud/60 p-4 md:grid-cols-[1fr_180px_1fr_auto] md:items-end">
            <div><label className="label" htmlFor="fn">Nomor FUPA Regional <span className="text-prtred">*</span></label><input id="fn" className="input" placeholder="mis. FUPA/R1/001/2026" value={fupa} onChange={(e) => setFupa(e.target.value)} /></div>
            <div><label className="label" htmlFor="fd">Tanggal pooling <span className="text-prtred">*</span></label><input id="fd" type="date" max={todayStr()} className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="label" htmlFor="fnt">Catatan</label><input id="fnt" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <button className="btn-primary" disabled={!sel.length || !fupa.trim() || !date} onClick={() => setConfirm(true)}><Layers className="h-4 w-4" />Buat Pooling ({sel.length})</button>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-navy">Histori pooling</h2>
        {poolings.length === 0 ? <div className="card"><Empty title="Belum ada pooling" /></div> : (
          <div className="space-y-3">
            {poolings.map((p) => (
              <div key={p.pooling_id} className={`card p-4 ${p.status !== "AKTIF" ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white"><Layers className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-navy">{p.fupa_number} <span className="ml-1 text-xs font-normal text-slate-400">{p.pooling_id}</span></div>
                    <div className="text-xs text-slate-500">{p.region_name} · {fmtDate(p.pooling_date)} · {p.members.length} pengajuan · {new Set(p.members.map((m: R) => m.spbu_id)).size} SPBU</div>
                  </div>
                  <span className={`chip ${p.status === "AKTIF" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>{p.status === "AKTIF" ? "Aktif" : "Dibatalkan"}</span>
                  {p.memo_number && <span className="chip bg-navy text-white ring-navy">{p.memo_number}</span>}
                  <button className="btn-ghost btn-sm" onClick={() => setOpen(open === p.pooling_id ? null : p.pooling_id)}>Detail anggota{open === p.pooling_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
                  {canEdit && p.status === "AKTIF" && !p.memo_id && <button className="btn-ghost btn-sm text-prtred" onClick={() => { setCancel(p); setReason(""); }}><Ban className="h-4 w-4" />Batalkan</button>}
                </div>
                {open === p.pooling_id && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {p.notes && <p className="mb-2 text-xs text-slate-500">Catatan: {p.notes}</p>}
                    {p.status !== "AKTIF" && <p className="mb-2 text-xs text-prtred">Dibatalkan {fmtDate(p.cancelled_at)}: {p.cancel_reason}</p>}
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {p.members.map((m: R) => <li key={m.submission_id} className="flex items-center justify-between gap-2 rounded-xl bg-cloud px-3 py-2 text-sm"><span><Link href={`/submissions/${m.submission_id}`} className="font-semibold text-brand hover:underline">{m.submission_id}</Link> · {m.spbu_name}</span><StatusBadge status={m.status} /></li>)}
                      {p.members.length === 0 && <li className="text-xs text-slate-400">Tidak ada anggota aktif.</li>}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} busy={busy} onConfirm={create} confirmLabel="Buat Pooling" title="Buat pooling FUPA Regional?"
        message={`${sel.length} pengajuan dari ${spbuSel} SPBU akan digabung ke nomor FUPA “${fupa}”. Status berubah menjadi “Sudah Masuk Pooling”.`} />
      <ConfirmModal open={!!cancel} onClose={() => setCancel(null)} busy={busy} onConfirm={doCancel} danger confirmLabel="Batalkan Pooling" title={`Batalkan pooling ${cancel?.fupa_number}?`}>
        <p className="mb-3 text-sm text-slate-600">Seluruh pengajuan anggota akan kembali berstatus <b>Disetujui</b>. Pembatalan tercatat dalam riwayat.</p>
        <label className="label" htmlFor="cr">Alasan pembatalan <span className="text-prtred">*</span></label>
        <textarea id="cr" className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmModal>
    </div>
  );
}

/* -------------------------------------------------------------------- MEMO */
function MemoTab({ canEdit, memos, memoable }: { canEdit: boolean; memos: R[]; memoable: R[] }) {
  const router = useRouter();
  const toast = useToast();
  const [num, setNum] = useState("");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [fwd, setFwd] = useState<R | null>(null);
  const [fs, setFs] = useState<{ status: string; date: string; notes: string }>({ status: FORWARD.YES, date: todayStr(), notes: "" });

  const create = async () => {
    setBusy(true);
    try { await api("/api/memos", { memo_number: num, memo_date: date, pooling_ids: sel, notes }); toast("success", "MEMO tercatat. Status pengajuan menjadi Sudah Di-Memo."); setNum(""); setNotes(""); setSel([]); setConfirm(false); router.refresh(); }
    catch (e: any) { toast("error", e.message); setConfirm(false); } finally { setBusy(false); }
  };
  const saveFwd = async () => {
    if (!fwd) return;
    setBusy(true);
    try { await api(`/api/memos/${fwd.memo_id}/forward`, { status: fs.status, forwarded_date: fs.date, notes: fs.notes }); toast("success", "Status penerusan ke PAM diperbarui."); setFwd(null); router.refresh(); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      {canEdit && (
        <section className="card overflow-hidden">
          <div className="border-b border-slate-100 p-4"><h2 className="font-bold text-navy">Catat MEMO Regional</h2><p className="text-xs text-slate-500">Persetujuan Manager/VP dan pembuatan MEMO dilakukan di luar GEMAS. Di sini hanya mencatat nomor dan tanggal MEMO.</p></div>
          <div className="space-y-4 p-4">
            <div>
              <div className="label">FUPA Regional yang tercakup <span className="text-prtred">*</span></div>
              {memoable.length === 0 ? <p className="rounded-xl bg-cloud p-3 text-sm text-slate-500">Belum ada pooling FUPA yang belum ber-MEMO. Buat pooling terlebih dahulu di tab Pooling FUPA.</p> : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {memoable.map((p) => (
                    <label key={p.pooling_id} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition ${sel.includes(p.pooling_id) ? "bg-softblue ring-brand" : "bg-white ring-slate-200 hover:bg-cloud"}`}>
                      <input type="checkbox" className="mt-1" checked={sel.includes(p.pooling_id)} onChange={() => setSel((s) => (s.includes(p.pooling_id) ? s.filter((x) => x !== p.pooling_id) : [...s, p.pooling_id]))} />
                      <span className="text-sm"><b className="text-navy">{p.fupa_number}</b><span className="block text-xs text-slate-500">{fmtDate(p.pooling_date)} · {p.members.length} pengajuan</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto] md:items-end">
              <div><label className="label" htmlFor="mn">Nomor MEMO <span className="text-prtred">*</span></label><input id="mn" className="input" value={num} onChange={(e) => setNum(e.target.value)} /></div>
              <div><label className="label" htmlFor="md">Tanggal MEMO <span className="text-prtred">*</span></label><input id="md" type="date" max={todayStr()} className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><label className="label" htmlFor="mt">Keterangan</label><input id="mt" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <button className="btn-primary" disabled={!sel.length || !num.trim() || !date} onClick={() => setConfirm(true)}><Send className="h-4 w-4" />Catat MEMO</button>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-navy">Daftar MEMO</h2>
        <DataTable rows={memos} rowKey={(m) => m.memo_id} exportName="memo" emptyTitle="Belum ada MEMO tercatat" searchPlaceholder="Cari nomor MEMO / FUPA…"
          filters={[{ label: "Penerusan PAM", get: (m) => m.forwarding?.status || FORWARD.NO, options: [FORWARD.NO, FORWARD.YES] }]}
          columns={[
            { key: "memo_number", header: "Nomor MEMO" },
            { key: "memo_date", header: "Tanggal", render: (m) => fmtDate(m.memo_date) },
            { key: "region_name", header: "Region" },
            { key: "fupa", header: "FUPA Tercakup", render: (m) => m.poolings.map((p: R) => p.fupa_number).join(", "), value: (m) => m.poolings.map((p: R) => p.fupa_number).join(", ") },
            { key: "subs", header: "Pengajuan", align: "right", render: (m) => <span title={m.submissions.map((s: R) => `${s.submission_id} ${s.spbu_name}`).join("\n")}>{m.submissions.length} <span className="text-xs text-slate-400">({new Set(m.submissions.map((s: R) => s.spbu_name)).size} SPBU)</span></span>, value: (m) => m.submissions.length },
            { key: "fwd", header: "Diteruskan ke PAM", render: (m) => { const f = m.forwarding; const yes = f?.status === FORWARD.YES; return <span className={`chip ${yes ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>{yes ? `Sudah · ${fmtDate(f.forwarded_date)}` : "Belum Diteruskan"}</span>; }, value: (m) => m.forwarding?.status || FORWARD.NO },
            ...(canEdit ? [{ key: "act", header: "Aksi", render: (m: R) => <button className="btn-ghost btn-sm" onClick={() => { setFwd(m); setFs({ status: m.forwarding?.status || FORWARD.YES, date: m.forwarding?.forwarded_date || todayStr(), notes: m.forwarding?.notes || "" }); }}><CalendarCheck className="h-4 w-4" />Penerusan PAM</button> }] : []),
          ]} />
      </section>

      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} busy={busy} onConfirm={create} confirmLabel="Catat MEMO" title="Catat MEMO Regional?" message={`MEMO “${num}” akan menghubungkan ${sel.length} FUPA Regional beserta seluruh pengajuan di dalamnya. Status pengajuan berubah menjadi “Sudah Di-Memo”.`} />
      <Modal open={!!fwd} onClose={() => setFwd(null)} title={`Penerusan MEMO ke PAM — ${fwd?.memo_number || ""}`} footer={<><button className="btn-ghost" onClick={() => setFwd(null)} disabled={busy}>Batal</button><button className="btn-primary" onClick={saveFwd} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan</button></>}>
        <p className="mb-3 rounded-xl bg-softblue/70 p-3 text-xs text-navy">Informasi monitoring tambahan. GEMAS tidak melakukan review substantif atau persetujuan oleh PAM.</p>
        <div className="space-y-3">
          <div><label className="label">Status penerusan</label><select className="input" value={fs.status} onChange={(e) => setFs({ ...fs, status: e.target.value })}><option>{FORWARD.NO}</option><option>{FORWARD.YES}</option></select></div>
          {fs.status === FORWARD.YES && <div><label className="label">Tanggal penerusan <span className="text-prtred">*</span></label><input type="date" max={todayStr()} className="input" value={fs.date} onChange={(e) => setFs({ ...fs, date: e.target.value })} /></div>}
          <div><label className="label">Keterangan (opsional)</label><textarea className="input min-h-[70px]" value={fs.notes} onChange={(e) => setFs({ ...fs, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}
