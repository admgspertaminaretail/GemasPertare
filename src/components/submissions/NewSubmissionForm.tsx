"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Download, Eye, FileSpreadsheet, FileText, Loader2, Send } from "lucide-react";
import type { IbosExtractItem } from "@/lib/services/ibos";
import { FileField } from "../ui/FileField";
import { ConfirmModal } from "../ui/Modal";
import { MonthlyIbosModal } from "./MonthlyIbosModal";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtPeriod, fmtSize, todayStr } from "@/lib/format";

export function NewSubmissionForm({
  spbuName,
  spbuCode,
  regionName,
  maxMb,
  ibosItems = [],
  daftarArsipTemplate,
  fupaTemplate,
}: {
  spbuName: string;
  spbuCode: string;
  regionName: string;
  maxMb: number;
  ibosItems?: IbosExtractItem[];
  daftarArsipTemplate?: { id: string; name: string } | null;
  fupaTemplate?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [desc, setDesc] = useState("");
  const [descTouched, setDescTouched] = useState(false);
  const [excel, setExcel] = useState<File[]>([]);
  const [arsipPdf, setArsipPdf] = useState<File[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [openIbos, setOpenIbos] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const latestIbos = ibosItems[0] || null;

  const done = [excel.length > 0, arsipPdf.length > 0, photos.length > 0];
  const validDesc = desc.trim().length >= 5;
  const completedSteps = [...done, validDesc].filter(Boolean).length;
  const pct = Math.round((completedSteps / 4) * 100);
  const ready = done.every(Boolean) && validDesc && !!date;

  const submit = async () => {
    setBusy(true); setErrors([]);
    const fd = new FormData();
    fd.set("submission_date", date);
    fd.set("description", desc);
    fd.set("excel", excel[0]);
    fd.set("fupa", arsipPdf[0]);
    photos.forEach((p) => fd.append("photos", p));
    try {
      const r = await api("/api/submissions", fd);
      toast("success", `Pengajuan ${r.id} berhasil dikirim ke PIC Region.`);
      router.push(`/submissions/${r.id}`);
      router.refresh();
    } catch (e: any) {
      setErrors([e.message]);
      toast("error", "Pengajuan belum dapat dikirim. Periksa pesan kesalahan.");
      setConfirm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {errors.length > 0 && (
          <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-prtred ring-1 ring-red-100">
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        <section className="card p-5">
          <h2 className="mb-4 font-bold text-navy">1. Data pengajuan</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Nama SPBU</label><input className="input" value={spbuName} disabled /></div>
            <div><label className="label">Kode SPBU</label><input className="input" value={spbuCode} disabled /></div>
            <div><label className="label">Region</label><input className="input" value={regionName} disabled /></div>
            <div>
              <label className="label" htmlFor="td">
                Tanggal pengajuan <span className="font-extrabold text-prtred">*</span>
              </label>
              <input id="td" type="date" max={todayStr()} className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="ds">
                  Keterangan pengajuan <span className="font-extrabold text-prtred">*</span>
                </label>
                <span className="text-[11px] font-semibold text-prtred">Wajib diisi</span>
              </div>
              <textarea
                id="ds"
                required
                className={`input min-h-[95px] ${descTouched && !validDesc ? "border-prtred ring-1 ring-prtred/30" : ""}`}
                maxLength={1000}
                placeholder="Jelaskan singkat arsip yang diusulkan musnah (jenis arsip, periode tahun, jumlah box)…"
                value={desc}
                onBlur={() => setDescTouched(true)}
                onChange={(e) => setDesc(e.target.value)}
              />
              {(descTouched || desc.length > 0) && !validDesc && (
                <p className="mt-1 text-xs font-semibold text-prtred">
                  Keterangan pengajuan wajib diisi (minimal 5 karakter).
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-navy">2. Dokumen pengajuan (wajib)</h2>
            <div className="flex flex-wrap items-center gap-2">
              {fupaTemplate && (
                <a
                  href={`/api/files/template/${fupaTemplate.id}?download=1`}
                  className="btn-ghost btn-sm bg-rose-50 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
                  title="Unduh Template Form FUPA (.pdf)"
                >
                  <Download className="h-3.5 w-3.5 text-prtred" />
                  Template Form FUPA (.pdf)
                </a>
              )}
              {daftarArsipTemplate && (
                <a
                  href={`/api/files/template/${daftarArsipTemplate.id}?download=1`}
                  className="btn-ghost btn-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  title="Unduh Template Daftar Arsip (.xlsx)"
                >
                  <Download className="h-3.5 w-3.5 text-prtgreen" />
                  Template Daftar Arsip (.xlsx)
                </a>
              )}
            </div>
          </div>
          <FileField
            kind="excel"
            label="Excel Daftar Arsip Usul Musnah"
            hint={`Format .xlsx · maks. ${maxMb} MB · harus berisi minimal 1 baris data`}
            accept=".xlsx"
            files={excel}
            onChange={setExcel}
          />
          <FileField
            kind="pdf"
            label="PDF Arsip Usul Musnah"
            hint={`Format .pdf · maks. ${maxMb} MB · dokumen Daftar Arsip Usul Musnah dalam bentuk PDF`}
            accept=".pdf,application/pdf"
            files={arsipPdf}
            onChange={setArsipPdf}
          />
          <FileField
            kind="image"
            label="Foto kondisi fisik arsip"
            hint={`Format .jpg/.png · maks. 10 foto · ${maxMb} MB per foto`}
            accept=".jpg,.jpeg,.png"
            multiple
            files={photos}
            onChange={setPhotos}
          />
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-navy">Kelengkapan</h3>
            <span className="text-sm font-extrabold text-brand">{pct}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-prtgreen" : "bg-brand"}`} style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ["Keterangan pengajuan", validDesc],
              ["Excel Daftar Arsip Usul Musnah", done[0]],
              ["PDF Arsip Usul Musnah", done[1]],
              ["Foto kondisi arsip", done[2]],
            ].map(([l, ok]) => (
              <li key={String(l)} className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${ok ? "bg-prtgreen" : "bg-slate-300"}`}>
                  {ok ? "✓" : ""}
                </span>
                <span className={ok ? "text-navy" : "text-slate-500"}>
                  {String(l)} <span className="text-prtred">*</span>
                </span>
              </li>
            ))}
          </ul>
          <button className="btn-primary mt-5 w-full" disabled={!ready || busy} onClick={() => setConfirm(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Kirim Pengajuan
          </button>
          {!ready && <p className="mt-2 text-center text-xs text-slate-500">Keterangan dan ketiga dokumen wajib harus lengkap.</p>}
        </div>

        {/* Shortcut khusus: Download Langsung Data Tarikan i-BOS Bulanan & Template Daftar Arsip */}
        <div className="card space-y-3 p-5 border border-slate-200/80 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">Data Arsip Acuan</h3>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              Update Back Office
            </span>
          </div>

          {latestIbos ? (
            <div className="space-y-1.5">
              <a
                href={`/api/files/ibos/${latestIbos.extract_id}?download=1`}
                className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-brand to-brand-700 p-3.5 text-left text-white shadow-card transition hover:opacity-95"
                title={`Unduh ${latestIbos.file_name} (${latestIbos.title})`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <Download className="h-5 w-5 transition group-hover:translate-y-0.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-black uppercase tracking-wide">
                      Data Tarikan i-BOS
                    </span>
                    <span className="rounded-full bg-amber-300 px-2 py-0.2 text-[10px] font-black text-navy">
                      {fmtPeriod(latestIbos.period)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-bold text-white">
                    Download File Bulan Ini (.xlsx)
                  </div>
                  <div className="text-[11px] text-white/75">
                    {fmtSize(latestIbos.size)} · Klik langsung unduh
                  </div>
                </div>
              </a>
              <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                <span>Diperbarui otomatis oleh Admin GS</span>
                <button
                  type="button"
                  onClick={() => setOpenIbos(true)}
                  className="font-bold text-brand hover:underline inline-flex items-center gap-1"
                >
                  <Eye className="h-3 w-3" />
                  Preview Isi
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
              Belum ada data tarikan i-BOS dari Back Office.
            </div>
          )}

          {fupaTemplate && (
            <a
              href={`/api/files/template/${fupaTemplate.id}?download=1`}
              className="flex items-center gap-2.5 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-800 ring-1 ring-rose-200 transition hover:bg-rose-100"
              title="Unduh Template Form FUPA (.pdf)"
            >
              <FileText className="h-4 w-4 shrink-0 text-prtred" />
              <span className="truncate">{fupaTemplate.name} (.pdf)</span>
              <Download className="ml-auto h-3.5 w-3.5 shrink-0 text-rose-600" />
            </a>
          )}

          {daftarArsipTemplate && (
            <a
              href={`/api/files/template/${daftarArsipTemplate.id}?download=1`}
              className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
              title="Unduh Template Daftar Arsip (.xlsx)"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-prtgreen" />
              <span className="truncate">{daftarArsipTemplate.name}</span>
              <Download className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-600" />
            </a>
          )}
        </div>
      </aside>

      <MonthlyIbosModal open={openIbos} onClose={() => setOpenIbos(false)} items={ibosItems} />

      <ConfirmModal
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={busy}
        onConfirm={submit}
        confirmLabel="Ya, kirim"
        title="Kirim pengajuan ke PIC Region?"
        message="Pastikan keterangan dan seluruh dokumen arsip usul musnah sudah benar. Setelah dikirim, pengajuan masuk antrean review PIC Region."
      />
    </div>
  );
}
