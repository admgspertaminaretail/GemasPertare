"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Cloud, Copy, Database, ExternalLink, FolderOpen, HardDrive, KeyRound,
  Loader2, RefreshCw, Sparkles, UploadCloud, AlertTriangle, FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/client";
import { useToast } from "../ui/Toast";
import { DataTable } from "../ui/DataTable";
import type { DatabaseStatus } from "@/lib/services/database";

export function DatabaseView({ initial }: { initial: DatabaseStatus }) {
  const router = useRouter();
  const toast = useToast();
  const [st, setSt] = useState<DatabaseStatus>(initial);
  const [parentFolderId, setParentFolderId] = useState(initial.parentFolderId || "");
  const [shareEmail, setShareEmail] = useState(initial.shareEmail || "");
  const [busy, setBusy] = useState<string | null>(null);

  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const isCloud = st.dbDriver === "sheets" && st.fileDriver === "drive";

  const copyText = async (txt: string, label: string) => {
    try {
      await navigator.clipboard.writeText(txt);
      toast("success", `${label} berhasil disalin.`);
    } catch {
      toast("error", "Gagal menyalin ke clipboard.");
    }
  };

  const refreshStatus = async () => {
    setBusy("refresh");
    try {
      const r = await api<DatabaseStatus>("/api/admin/database", undefined, "GET");
      setSt(r);
      toast("success", "Status koneksi & kredensial diperbarui.");
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleKeyFileUpload = async (file: File | null) => {
    if (!file) return;
    setBusy("key");
    try {
      const keyJson = await file.text();
      const r = await api<{ credential: { email: string }; status: DatabaseStatus }>("/api/admin/database", {
        action: "upload_key",
        keyJson,
      });
      setSt(r.status);
      toast("success", `Kunci berhasil dipasang! Silakan Share folder Drive Anda ke: ${r.credential.email}`);
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const runAutoInit = async () => {
    setBusy("init");
    try {
      const r = await api<{ result: any; status: DatabaseStatus }>("/api/admin/database", {
        action: "init",
        parentFolderId,
        shareEmail,
        activate: true,
      });
      setSt(r.status);
      toast(
        "success",
        `Berhasil! Folder Drive & Spreadsheet GEMAS (${r.status.counts.length} tab) sudah siap dan aktif.`
      );
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const syncLocalToSheets = async () => {
    setBusy("sync");
    try {
      const r = await api<{ result: any; status: DatabaseStatus }>("/api/admin/database", { action: "sync" });
      setSt(r.status);
      toast("success", `${r.result.seededRows} baris data lokal berhasil disalin ke Google Sheets.`);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const switchMode = async (mode: "local" | "google") => {
    setBusy("switch");
    try {
      const r = await api<{ status: DatabaseStatus }>("/api/admin/database", { action: "switch", mode });
      setSt(r.status);
      toast("success", mode === "google" ? "Beralih ke Google Sheets & Google Drive." : "Beralih ke penyimpanan Lokal (data/db.json).");
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const submitTestUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || uploadTitle.trim().length < 2) return;
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.set("title", uploadTitle.trim());
      fd.set("file", uploadFile);
      const r = await api<{ ref: string; status: DatabaseStatus }>("/api/admin/database", fd);
      setSt(r.status);
      setUploadTitle("");
      setUploadFile(null);
      toast("success", `Berkas berhasil diunggah (${r.ref}) dan tercatat otomatis ke tabel FILE_INDEX.`);
      router.refresh();
    } catch (err: any) {
      toast("error", err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Kartu ringkasan status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Mode Penyimpanan Aktif</span>
            <span className={`chip ${isCloud ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-blue-50 text-brand ring-blue-200"}`}>
              {isCloud ? "Google Cloud Aktif" : "Mode Lokal (JSON)"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${isCloud ? "bg-prtgreen" : "bg-navy"}`}>
              {isCloud ? <Cloud className="h-6 w-6" /> : <HardDrive className="h-6 w-6" />}
            </div>
            <div>
              <div className="text-base font-extrabold text-navy">
                {isCloud ? "Google Sheets + Google Drive" : "File JSON Lokal + Folder Uploads"}
              </div>
              <div className="text-xs text-slate-500">
                DB: <code>{st.dbDriver}</code> · File: <code>{st.fileDriver}</code>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || !isCloud} onClick={() => switchMode("local")} className="btn-ghost btn-sm">
              Gunakan Lokal
            </button>
            <button type="button" disabled={!!busy || isCloud || !st.credential.found} onClick={() => switchMode("google")} className="btn-primary btn-sm">
              {busy === "switch" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Gunakan Google Cloud
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Kunci Service Account</span>
            <button type="button" onClick={refreshStatus} disabled={!!busy} className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} />Cek Ulang
            </button>
          </div>
          {st.credential.found ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-prtgreen" />
                <span>Terdeteksi ({st.credential.source})</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-navy ring-1 ring-slate-200/80">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Email Service Account (klik salin untuk Share folder Drive)</div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <code className="truncate font-semibold">{st.credential.email}</code>
                  <button type="button" onClick={() => copyText(st.credential.email, "Email Service Account")} className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-brand ring-1 ring-slate-200 hover:bg-softblue">
                    <Copy className="inline h-3 w-3 mr-1" />Salin
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-700">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <span>Belum ada file kunci JSON</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Klik tombol di bawah untuk mengunggah file JSON kunci dari Google Cloud Console (otomatis disimpan ke <code>credentials/service-account.json</code>):
              </p>
              <label className="btn-primary btn-sm inline-flex cursor-pointer">
                {busy === "key" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                Pilih &amp; Pasang File JSON Kunci
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  disabled={!!busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.currentTarget.value = "";
                    handleKeyFileUpload(f);
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <div className="card p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Resource Google Terhubung</span>
          <div className="mt-3 space-y-2.5">
            {st.spreadsheetUrl ? (
              <a href={st.spreadsheetUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-emerald-50/70 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
                <span className="inline-flex items-center gap-2 truncate"><FileSpreadsheet className="h-4 w-4 shrink-0 text-prtgreen" />GEMAS_Database_Master</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400 ring-1 ring-slate-100">Spreadsheet belum diinisialisasi</div>
            )}
            {st.folderUrl ? (
              <a href={st.folderUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-blue-50/70 px-3 py-2 text-xs font-semibold text-brand ring-1 ring-blue-200 hover:bg-blue-50">
                <span className="inline-flex items-center gap-2 truncate"><FolderOpen className="h-4 w-4 shrink-0" />GEMAS_Arsip_Storage</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400 ring-1 ring-slate-100">Folder Drive belum diinisialisasi</div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Inisialisasi Otomatis */}
      <section className="card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-navy flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              1. Inisialisasi Otomatis Google Drive &amp; Spreadsheet (Auto-Init)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Jika folder penyimpanan atau Spreadsheet pelacak belum ada di Google Drive Anda, sistem otomatis membuatnya lengkap dengan {st.counts.length} tab &amp; kolom skema GEMAS serta menyalin data awal.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="pf">Link atau ID Folder Induk Google Drive Anda (Sangat Disarankan)</label>
            <input
              id="pf"
              className="input"
              placeholder="Contoh: https://drive.google.com/drive/folders/1AbCdEfGhIjK..."
              value={parentFolderId}
              onChange={(e) => setParentFolderId(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Buat 1 folder kosong di Google Drive Anda → klik kanan <b>Bagikan (Share)</b> ke email Service Account sebagai <b>Editor</b> → tempel link foldernya di sini agar memakai kuota Drive Anda dan langsung terlihat di Drive Anda.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="se">Email Google Anda untuk Akses Otomatis (Opsional)</label>
            <input
              id="se"
              type="text"
              className="input"
              placeholder="Contoh: adm.gs.pertaminaretail@gmail.com, rikatnalendra25@gmail.com"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Jika lebih dari 1 email, pisahkan dengan tanda koma (<code>,</code>). Sistem otomatis membagikan akses Editor ke email tersebut.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={runAutoInit} disabled={!!busy || !st.credential.found} className="btn-primary">
            {busy === "init" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Inisialisasi Otomatis &amp; Aktifkan Google Cloud
          </button>
          {st.sheetsId && (
            <button type="button" onClick={syncLocalToSheets} disabled={!!busy || !st.credential.found} className="btn-ghost">
              {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Salin Ulang Data Lokal ke Google Sheets
            </button>
          )}
          {!st.credential.found && (
            <span className="text-xs font-medium text-amber-700">
              Letakkan <code>credentials/service-account.json</code> terlebih dahulu lalu klik <b>Cek Ulang</b>.
            </span>
          )}
        </div>
      </section>

      {/* Panel Uji Unggah Berkas & Tabel Pelacak FILE_INDEX */}
      <section className="card p-5 space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-navy flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-brand" />
            2. Unggah Berkas &amp; Pelacakan Otomatis (<code>FILE_INDEX</code>)
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Setiap berkas yang diunggah dari formulir pengajuan SPBU, Template, Pusat Informasi, maupun formulir uji cepat di bawah ini otomatis tersimpan ke penyimpanan aktif dan tercatat di tab <code>FILE_INDEX</code> (ID, Title, FileURL, Timestamp).
          </p>
        </div>

        <form onSubmit={submitTestUpload} className="flex flex-wrap items-end gap-3 rounded-2xl bg-softblue/40 p-4 ring-1 ring-blue-100">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="ut">Judul Berkas / Dokumen *</label>
            <input
              id="ut"
              className="input"
              placeholder="Contoh: Berita Acara Uji Integrasi Drive"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>
          <div className="min-w-[240px] flex-1">
            <label className="label" htmlFor="uf">Pilih File (.pdf, .xlsx, .docx, .jpg, .png) *</label>
            <input
              id="uf"
              type="file"
              accept=".pdf,.xlsx,.docx,.jpg,.jpeg,.png"
              className="input py-2 text-xs"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <button className="btn-primary" disabled={!!busy || !uploadFile || uploadTitle.trim().length < 2}>
            {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Unggah &amp; Catat
          </button>
        </form>

        <DataTable
          rows={st.fileIndex}
          rowKey={(r) => r.file_id}
          exportName="indeks-berkas-gemas"
          pageSize={8}
          emptyTitle="Belum ada berkas baru yang tercatat di FILE_INDEX"
          emptyText="Unggah berkas melalui formulir di atas atau buat pengajuan baru untuk melihat pencatatan otomatis (ID, Title, FileURL, Timestamp)."
          columns={[
            { key: "file_id", header: "ID" },
            { key: "title", header: "Title / Judul" },
            { key: "category", header: "Kategori" },
            { key: "file_name", header: "Nama File" },
            { key: "size_bytes", header: "Ukuran", align: "right", render: (r) => `${Math.max(1, Math.round(Number(r.size_bytes || 0) / 1024))} KB` },
            {
              key: "file_url",
              header: "FileURL",
              render: (r) => (
                <div className="flex items-center gap-2">
                  <a href={`/api/files/index/${r.file_id}`} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                    Buka via App
                  </a>
                  {r.file_url?.startsWith("http") && (
                    <a href={r.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-emerald-700 hover:underline">
                      Drive <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ),
            },
            { key: "uploaded_by", header: "Pengunggah" },
            { key: "timestamp", header: "Timestamp", render: (r) => (r.timestamp || "").replace("T", " ").slice(0, 19) },
          ]}
        />
      </section>

      {/* Ringkasan Skema 19 Tabel */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-navy flex items-center gap-2">
          <Database className="h-4 w-4 text-brand" />
          Struktur {st.counts.length} Tabel Database Aktif ({isCloud ? "Google Sheets" : "Local JSON"})
        </h2>
        <DataTable
          rows={st.counts}
          rowKey={(r) => r.table}
          exportName="skema-tabel-gemas"
          pageSize={20}
          searchPlaceholder="Cari nama tabel…"
          columns={[
            { key: "table", header: "Nama Sheet / Tabel" },
            { key: "columns", header: "Jumlah Kolom", align: "right" },
            { key: "rows", header: "Jumlah Baris Data", align: "right" },
          ]}
        />
      </section>
    </div>
  );
}
