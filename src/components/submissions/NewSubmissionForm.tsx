"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Download, FileSpreadsheet, Loader2, Send } from "lucide-react";
import { FileField } from "../ui/FileField";
import { ConfirmModal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { todayStr } from "@/lib/format";

export function NewSubmissionForm({
  spbuName,
  spbuCode,
  regionName,
  maxMb,
  templates,
}: {
  spbuName: string;
  spbuCode: string;
  regionName: string;
  maxMb: number;
  templates: { id: string; name: string; category?: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [desc, setDesc] = useState("");
  const [excel, setExcel] = useState<File[]>([]);
  const [fupa, setFupa] = useState<File[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const daftarArsipTpl =
    templates.find((t) => t.category === "Daftar Arsip") ||
    templates.find((t) => /daftar arsip/i.test(t.name)) ||
    null;

  const done = [excel.length > 0, fupa.length > 0, photos.length > 0];
  const pct = Math.round((done.filter(Boolean).length / 3) * 100);
  const validDesc = desc.trim().length >= 5;
  const ready = pct === 100 && validDesc && !!date;

  const submit = async () => {
    setBusy(true); setErrors([]);
    const fd = new FormData();
    fd.set("submission_date", date); fd.set("description", desc);
    fd.set("excel", excel[0]);
    fd.set("fupa", fupa[0]);
    photos.forEach((p) => fd.append("photos", p));
    try {
      const r = await api("/api/submissions", fd);
      toast("success", `Pengajuan ${r.id} berhasil dikirim ke PIC Region.`);
      router.push(`/submissions/${r.id}`); router.refresh();
    } catch (e: any) { setErrors([e.message]); toast("error", "Pengajuan belum dapat dikirim. Periksa pesan kesalahan."); setConfirm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {errors.length > 0 && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-prtred ring-1 ring-red-100">{errors.map((e, i) => <p key={i}>{e}</p>)}</div>}
        <section className="card p-5">
          <h2 className="mb-4 font-bold text-navy">1. Data pengajuan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nama SPBU</label><input className="input" value={spbuName} disabled /></div>
            <div><label className="label">Kode SPBU</label><input className="input" value={spbuCode} disabled /></div>
            <div><label className="label">Region</label><input className="input" value={regionName} disabled /></div>
            <div><label className="label" htmlFor="td">Tanggal pengajuan *</label><input id="td" type="date" max={todayStr()} className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="ds">Keterangan pengajuan *</label>
              <textarea id="ds" className="input min-h-[90px]" maxLength={1000} placeholder="Jelaskan singkat arsip yang diusulkan musnah (jenis, periode, jumlah box)…" value={desc} onChange={(e) => setDesc(e.target.value)} />
              {desc.length > 0 && !validDesc && <p className="mt-1 text-xs text-prtred">Minimal 5 karakter.</p>}</div>
          </div>
        </section>
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-navy">2. Dokumen pengajuan (wajib)</h2>
            {daftarArsipTpl && (
              <a
                href={`/api/files/template/${daftarArsipTpl.id}?download=1`}
                className="btn-ghost btn-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
              >
                <Download className="h-3.5 w-3.5" />
                Unduh Template Daftar Arsip (.xlsx)
              </a>
            )}
          </div>
          <FileField kind="excel" label="Excel Daftar Arsip Usul Musnah" hint={`Format .xlsx · maks. ${maxMb} MB · harus berisi minimal 1 baris data`} accept=".xlsx" files={excel} onChange={setExcel} />
          <FileField kind="pdf" label="PDF Form FUPA (ditandatangani ABH)" hint={`Format .pdf · maks. ${maxMb} MB`} accept=".pdf,application/pdf" files={fupa} onChange={setFupa} />
          <FileField kind="image" label="Foto kondisi fisik arsip" hint={`Format .jpg/.png · maks. 10 foto · ${maxMb} MB per foto`} accept=".jpg,.jpeg,.png" multiple files={photos} onChange={setPhotos} />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between"><h3 className="font-bold text-navy">Kelengkapan</h3><span className="text-sm font-extrabold text-brand">{pct}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-prtgreen" : "bg-brand"}`} style={{ width: `${pct}%` }} /></div>
          <ul className="mt-4 space-y-2 text-sm">
            {[["Excel Daftar Arsip", done[0]], ["PDF Form FUPA", done[1]], ["Foto kondisi arsip", done[2]], ["Keterangan pengajuan", validDesc]].map(([l, ok]) => (
              <li key={String(l)} className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${ok ? "bg-prtgreen" : "bg-slate-300"}`}>{ok ? "✓" : ""}</span><span className={ok ? "text-navy" : "text-slate-500"}>{String(l)}</span></li>
            ))}
          </ul>
          <button className="btn-primary mt-5 w-full" disabled={!ready || busy} onClick={() => setConfirm(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Kirim Pengajuan</button>
          {!ready && <p className="mt-2 text-center text-xs text-slate-500">Semua dokumen wajib harus lengkap.</p>}
        </div>
        <div className="card p-5">
          <h3 className="mb-2 text-sm font-bold text-navy">Shortcut Template &amp; Data</h3>
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <a className="flex items-center gap-2 rounded-xl bg-cloud px-3 py-2 text-sm font-semibold text-brand ring-1 ring-slate-200/70 transition hover:bg-softblue" href={`/api/files/template/${t.id}?download=1`}>
                  <Download className="h-4 w-4 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl bg-softblue/60 p-3 text-xs text-navy ring-1 ring-blue-100">
            <div className="font-bold flex items-center gap-1.5 text-brand">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Data Arsip Tarikan i-BOS Bulanan
            </div>
            <p className="mt-1 text-slate-600">Unduh data tarikan i-BOS per bulan yang dibagikan Admin GS.</p>
            <Link href="/tarikan-ibos" className="mt-1.5 inline-flex items-center gap-1 font-bold text-brand hover:underline">
              Buka Data Tarikan i-BOS <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Link href="/templates" className="mt-3 inline-block text-xs text-slate-500 hover:text-brand">Buka Pusat Template →</Link>
        </div>
      </aside>

      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} busy={busy} onConfirm={submit} confirmLabel="Ya, kirim" title="Kirim pengajuan ke PIC Region?" message="Pastikan seluruh dokumen sudah benar. Setelah dikirim, pengajuan masuk antrean review PIC Region dan dokumen tersimpan dengan riwayat." />
    </div>
  );
}
