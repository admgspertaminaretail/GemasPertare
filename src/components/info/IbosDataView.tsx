"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Calendar,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe2,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { IbosExtractItem, IbosTargetScope } from "@/lib/services/ibos";
import { DemoTag, Empty } from "../ui/kit";
import { ConfirmModal, Modal } from "../ui/Modal";
import { FileField } from "../ui/FileField";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDateTime, fmtSize, todayStr } from "@/lib/format";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function fmtPeriodLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return ym || "-";
  const idx = Number(m[2]) - 1;
  return `${MONTHS_ID[idx] || m[2]} ${m[1]}`;
}

interface FormState {
  period: string;
  title: string;
  target_scope: IbosTargetScope;
  region_id: string;
  spbu_id: string;
  description: string;
}

export function IbosDataView({
  items,
  regions,
  spbus,
  daftarArsipTemplate,
  canManage,
  role,
  maxMb = 4,
}: {
  items: IbosExtractItem[];
  regions: { region_id: string; region_name: string }[];
  spbus: { spbu_id: string; spbu_code: string; name: string; region_id: string; region_name: string }[];
  daftarArsipTemplate: { id: string; name: string; version: string } | null;
  canManage: boolean;
  role: string;
  maxMb?: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const defaultPeriod = todayStr().slice(0, 7);
  const makeDefaultForm = (period = defaultPeriod): FormState => ({
    period,
    title: `Data Arsip Tarikan i-BOS — ${fmtPeriodLabel(period)}`,
    target_scope: "ALL",
    region_id: regions[0]?.region_id || "",
    spbu_id: spbus[0]?.spbu_id || "",
    description: "",
  });

  const [periodFilter, setPeriodFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [q, setQ] = useState("");

  const [edit, setEdit] = useState<{ id?: string; form: FormState } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [toggleItem, setToggleItem] = useState<IbosExtractItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<IbosExtractItem | null>(null);
  const [tableModal, setTableModal] = useState<IbosExtractItem | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [filePreview, setFilePreview] = useState<PreviewTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const periods = useMemo(
    () => Array.from(new Set(items.map((i) => i.period))).sort((a, b) => b.localeCompare(a)),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (periodFilter && it.period !== periodFilter) return false;
      if (scopeFilter && it.target_scope !== scopeFilter) return false;
      if (needle) {
        const hay = `${it.title} ${it.period} ${fmtPeriodLabel(it.period)} ${it.target_label} ${it.file_name} ${it.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, periodFilter, scopeFilter, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, IbosExtractItem[]>();
    for (const it of filtered) {
      const arr = map.get(it.period) || [];
      arr.push(it);
      map.set(it.period, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const openCreate = () => {
    setEdit({ form: makeDefaultForm() });
    setFiles([]);
  };

  const openEdit = (it: IbosExtractItem) => {
    setEdit({
      id: it.extract_id,
      form: {
        period: it.period,
        title: it.title,
        target_scope: it.target_scope,
        region_id: it.region_id || regions[0]?.region_id || "",
        spbu_id: it.spbu_id || spbus[0]?.spbu_id || "",
        description: it.description,
      },
    });
    setFiles([]);
  };

  const submitForm = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("action", edit.id ? "update" : "create");
      if (edit.id) fd.set("id", edit.id);
      fd.set("period", edit.form.period);
      fd.set("title", edit.form.title);
      fd.set("target_scope", edit.form.target_scope);
      fd.set("region_id", edit.form.region_id);
      fd.set("spbu_id", edit.form.spbu_id);
      fd.set("description", edit.form.description);
      if (files[0]) fd.set("file", files[0]);
      await api("/api/ibos", fd);
      toast("success", edit.id ? "Data Arsip Tarikan i-BOS diperbarui." : "Data Arsip Tarikan i-BOS berhasil diunggah dan dibagikan.");
      setEdit(null);
      setFiles([]);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmToggle = async () => {
    if (!toggleItem) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("action", "toggle");
      fd.set("id", toggleItem.extract_id);
      fd.set("active", toggleItem.status === "Aktif" ? "0" : "1");
      await api("/api/ibos", fd);
      toast("success", toggleItem.status === "Aktif" ? "Berkas dinonaktifkan." : "Berkas diaktifkan kembali.");
      setToggleItem(null);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("action", "delete");
      fd.set("id", deleteItem.extract_id);
      await api("/api/ibos", fd);
      toast("success", "Data Arsip Tarikan i-BOS dihapus.");
      setDeleteItem(null);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const openPreview = (it: IbosExtractItem) => {
    if (it.headers.length > 0 && it.rows.length > 0) {
      setTableSearch("");
      setTableModal(it);
    } else {
      setFilePreview({ kind: "ibos", id: it.extract_id, name: it.file_name, mime: it.mime });
    }
  };

  const modalRows = useMemo(() => {
    if (!tableModal) return [];
    const s = tableSearch.trim().toLowerCase();
    if (!s) return tableModal.rows;
    return tableModal.rows.filter((r) => r.some((c) => c.toLowerCase().includes(s)));
  }, [tableModal, tableSearch]);

  return (
    <div className="space-y-5">
      {/* Banner alur kerja sesuai role */}
      <section className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-softblue text-brand">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-bold text-navy">
              {canManage
                ? "Distribusi Bulanan Data Arsip Tarikan i-BOS (Admin GS)"
                : "Unduh Data Arsip Tarikan i-BOS Bulanan"}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
              {canManage
                ? "Unggah file tarikan arsip dari i-BOS setiap bulan untuk seluruh SPBU, per Region, atau SPBU tertentu. Admin SPBU hanya dapat melihat dan mengunduh berkas yang Anda bagikan."
                : "Data di bawah ini diunggah setiap bulan oleh Admin GS / Head Office. Unduh berkas sesuai periode bulan, lalu salin arsip yang memenuhi masa retensi ke Template Daftar Arsip Usul Musnah."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage ? (
            <button className="btn-primary" onClick={openCreate}>
              <Upload className="h-4 w-4" />
              Unggah Data Tarikan i-BOS
            </button>
          ) : (
            <>
              {daftarArsipTemplate && (
                <a
                  href={`/api/files/template/${daftarArsipTemplate.id}?download=1`}
                  className="btn-ghost btn-sm bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" />
                  Template Daftar Arsip (.xlsx)
                </a>
              )}
              {role === "ADMIN_SPBU" && (
                <Link href="/submissions/new" className="btn-primary btn-sm">
                  Buat Pengajuan Usul Musnah
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </>
          )}
        </div>
      </section>

      {/* Ringkasan metrik */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500">Berkas Tarikan Tersedia</div>
          <div className="mt-1 text-2xl font-extrabold text-navy">{items.filter((i) => i.status === "Aktif").length}</div>
          <div className="text-[11px] text-slate-400">
            {canManage ? `${items.length} total termasuk arsip nonaktif` : "Siap diunduh oleh unit Anda"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500">Periode Terbaru</div>
          <div className="mt-1 text-2xl font-extrabold text-brand">
            {periods[0] ? fmtPeriodLabel(periods[0]) : "Belum ada"}
          </div>
          <div className="text-[11px] text-slate-400">{periods.length} periode bulan tercatat</div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-500">Hak Akses Anda</div>
          <div className="mt-1 text-base font-extrabold text-prtgreen">
            {canManage ? "Admin GS · Unggah & Kelola" : "Lihat & Download Saja"}
          </div>
          <div className="text-[11px] text-slate-400">
            {canManage ? "Dapat mengatur distribusi Nasional / Region / SPBU" : "Dikelola terpusat oleh Admin GS"}
          </div>
        </div>
      </div>

      {/* Filter Periode Bulan & Pencarian */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1 text-xs font-bold text-navy">
            <Calendar className="h-3.5 w-3.5 text-brand" />
            Periode Bulan:
          </span>
          <button
            onClick={() => setPeriodFilter("")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
              periodFilter === "" ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"
            }`}
          >
            Semua Periode ({items.length})
          </button>
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                periodFilter === p ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"
              }`}
            >
              {fmtPeriodLabel(p)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Cari judul tarikan i-BOS, bulan, Region/SPBU, atau nama file…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {canManage && (
            <select
              className="input w-auto min-w-[190px]"
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              aria-label="Filter cakupan penerima"
            >
              <option value="">Semua Target Penerima</option>
              <option value="ALL">Seluruh SPBU (Nasional)</option>
              <option value="REGION">Per Region</option>
              <option value="SPBU">SPBU Tertentu</option>
            </select>
          )}
        </div>
      </div>

      {/* Daftar Berkas per Periode Bulan */}
      {grouped.length === 0 ? (
        <div className="card">
          <Empty
            title="Belum ada Data Arsip Tarikan i-BOS"
            text={
              canManage
                ? "Klik tombol “Unggah Data Tarikan i-BOS” untuk membagikan data tarikan bulanan kepada SPBU."
                : "Admin GS belum mengunggah berkas Data Arsip Tarikan i-BOS untuk periode yang dipilih."
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([period, groupItems]) => (
            <section key={period} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-navy px-3 py-1 text-xs font-bold text-white shadow-sm">
                  <Calendar className="h-3.5 w-3.5" />
                  {fmtPeriodLabel(period)}
                </span>
                <span className="text-xs text-slate-500">{groupItems.length} berkas tarikan data</span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {groupItems.map((it) => {
                  const isExcel = it.file_name.toLowerCase().endsWith(".xlsx");
                  const ScopeIcon =
                    it.target_scope === "SPBU" ? Building2 : it.target_scope === "REGION" ? MapPin : Globe2;

                  return (
                    <article
                      key={it.extract_id}
                      className={`card flex flex-col justify-between p-5 transition hover:shadow-pop ${
                        it.status !== "Aktif" ? "opacity-65" : ""
                      }`}
                    >
                      <div>
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm ${
                              isExcel ? "bg-prtgreen" : "bg-prtred"
                            }`}
                          >
                            {isExcel ? <FileSpreadsheet className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="chip bg-softblue text-brand ring-blue-100">
                                {fmtPeriodLabel(it.period)}
                              </span>
                              <span className="chip bg-slate-100 text-navy ring-slate-200">
                                <ScopeIcon className="mr-1 inline h-3 w-3 text-brand" />
                                {it.target_label}
                              </span>
                              {it.total_rows > 0 && (
                                <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
                                  {it.total_rows} baris arsip
                                </span>
                              )}
                              {canManage && (
                                <span
                                  className={`chip ${
                                    it.status === "Aktif"
                                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                      : "bg-slate-200 text-slate-600 ring-slate-300"
                                  }`}
                                >
                                  {it.status}
                                </span>
                              )}
                              {it.is_demo && <DemoTag />}
                            </div>
                            <h3 className="mt-2 font-bold leading-snug text-navy">{it.title}</h3>
                          </div>
                        </div>

                        {it.description && (
                          <p className="mt-3 text-sm text-slate-600">{it.description}</p>
                        )}

                        <div className="mt-3 rounded-xl bg-cloud px-3 py-2 text-xs text-slate-500">
                          <div className="truncate font-semibold text-navy">{it.file_name}</div>
                          <div className="mt-0.5">
                            {fmtSize(it.size)} · Diunggah oleh <b>{it.uploaded_by_name}</b> · {fmtDateTime(it.uploaded_at)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                        <a
                          href={`/api/files/ibos/${it.extract_id}?download=1`}
                          className="btn-primary btn-sm"
                        >
                          <Download className="h-4 w-4" />
                          Download Data
                        </a>
                        <button
                          type="button"
                          onClick={() => openPreview(it)}
                          className="btn-ghost btn-sm ring-1 ring-slate-200"
                        >
                          <Eye className="h-4 w-4" />
                          {isExcel ? "Lihat Isi Tabel" : "Preview"}
                        </button>

                        {canManage && (
                          <div className="ml-auto flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => openEdit(it)}
                              title="Ubah"
                            >
                              <Pencil className="h-4 w-4" />
                              Ubah
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => setToggleItem(it)}
                              title={it.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                            >
                              <Power className="h-4 w-4" />
                              {it.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost btn-sm text-prtred hover:bg-red-50"
                              onClick={() => setDeleteItem(it)}
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Modal Pratinjau Tabel Excel Interaktif */}
      <Modal
        open={!!tableModal}
        wide
        onClose={() => setTableModal(null)}
        title={tableModal ? `${tableModal.title} (${fmtPeriodLabel(tableModal.period)})` : "Pratinjau Data Tarikan"}
        footer={
          tableModal ? (
            <>
              <button className="btn-ghost" onClick={() => setTableModal(null)}>
                Tutup
              </button>
              <a className="btn-primary" href={`/api/files/ibos/${tableModal.extract_id}?download=1`}>
                <Download className="h-4 w-4" />
                Download Excel (.xlsx)
              </a>
            </>
          ) : undefined
        }
      >
        {tableModal && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-slate-500">
                Lembar <b>{tableModal.sheet}</b> · Menampilkan <b>{modalRows.length}</b> dari{" "}
                <b>{tableModal.total_rows}</b> baris data tarikan i-BOS.
              </div>
              <div className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  className="input py-1.5 pl-8 text-xs"
                  placeholder="Cari kode/nama dokumen atau SPBU di tabel…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="scroll-thin max-h-[58vh] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-navy text-white">
                  <tr>
                    {tableModal.headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2.5 text-left font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {modalRows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1, tableModal.headers.length)} className="px-4 py-8 text-center text-slate-400">
                        Tidak ada baris yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    modalRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-softblue/40">
                        {tableModal.headers.map((_, cIdx) => (
                          <td key={cIdx} className="whitespace-nowrap px-3 py-2 text-slate-700">
                            {row[cIdx] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <FilePreview target={filePreview} onClose={() => setFilePreview(null)} />

      {/* Modal Unggah / Ubah — khusus Admin GS / PAM */}
      {canManage && (
        <>
          <Modal
            open={!!edit}
            wide
            onClose={() => {
              if (!busy) {
                setEdit(null);
                setFiles([]);
              }
            }}
            title={edit?.id ? "Ubah Data Arsip Tarikan i-BOS" : "Unggah Data Arsip Tarikan i-BOS Bulanan"}
            footer={
              <>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setEdit(null);
                    setFiles([]);
                  }}
                  disabled={busy}
                >
                  Batal
                </button>
                <button
                  className="btn-primary"
                  onClick={submitForm}
                  disabled={
                    busy ||
                    !edit?.form.period ||
                    edit.form.title.trim().length < 3 ||
                    (!edit.id && files.length === 0)
                  }
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {edit?.id ? "Simpan Perubahan" : "Unggah & Bagikan ke SPBU"}
                </button>
              </>
            }
          >
            {edit && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="ibos-period">
                      Periode Bulan *
                    </label>
                    <input
                      id="ibos-period"
                      type="month"
                      className="input"
                      value={edit.form.period}
                      onChange={(e) => {
                        const nextPeriod = e.target.value;
                        const prevAuto = `Data Arsip Tarikan i-BOS — ${fmtPeriodLabel(edit.form.period)}`;
                        const nextTitle =
                          !edit.id && (edit.form.title === prevAuto || !edit.form.title.trim())
                            ? `Data Arsip Tarikan i-BOS — ${fmtPeriodLabel(nextPeriod)}`
                            : edit.form.title;
                        setEdit({
                          ...edit,
                          form: { ...edit.form, period: nextPeriod, title: nextTitle },
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ibos-scope">
                      Target Penerima SPBU *
                    </label>
                    <select
                      id="ibos-scope"
                      className="input"
                      value={edit.form.target_scope}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          form: { ...edit.form, target_scope: e.target.value as IbosTargetScope },
                        })
                      }
                    >
                      <option value="ALL">Seluruh SPBU (Nasional)</option>
                      <option value="REGION">Per Region Tertentu</option>
                      <option value="SPBU">SPBU Tertentu</option>
                    </select>
                  </div>
                </div>

                {edit.form.target_scope === "REGION" && (
                  <div>
                    <label className="label" htmlFor="ibos-reg">
                      Pilih Region Tujuan *
                    </label>
                    <select
                      id="ibos-reg"
                      className="input"
                      value={edit.form.region_id}
                      onChange={(e) =>
                        setEdit({ ...edit, form: { ...edit.form, region_id: e.target.value } })
                      }
                    >
                      {regions.map((r) => (
                        <option key={r.region_id} value={r.region_id}>
                          {r.region_name} ({r.region_id})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {edit.form.target_scope === "SPBU" && (
                  <div>
                    <label className="label" htmlFor="ibos-spbu">
                      Pilih SPBU Tujuan *
                    </label>
                    <select
                      id="ibos-spbu"
                      className="input"
                      value={edit.form.spbu_id}
                      onChange={(e) =>
                        setEdit({ ...edit, form: { ...edit.form, spbu_id: e.target.value } })
                      }
                    >
                      {spbus.map((s) => (
                        <option key={s.spbu_id} value={s.spbu_id}>
                          SPBU {s.spbu_code} — {s.name} ({s.region_name})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="ibos-title">
                    Judul Data Tarikan *
                  </label>
                  <input
                    id="ibos-title"
                    className="input"
                    placeholder="Mis. Data Arsip Tarikan i-BOS Nasional — November 2026"
                    value={edit.form.title}
                    onChange={(e) =>
                      setEdit({ ...edit, form: { ...edit.form, title: e.target.value } })
                    }
                  />
                </div>

                <div>
                  <label className="label" htmlFor="ibos-desc">
                    Keterangan / Catatan untuk Admin SPBU (opsional)
                  </label>
                  <textarea
                    id="ibos-desc"
                    className="input min-h-[75px]"
                    placeholder="Jelaskan cakupan data tarikan bulan ini atau instruksi penyaringan arsip usul musnah…"
                    value={edit.form.description}
                    onChange={(e) =>
                      setEdit({ ...edit, form: { ...edit.form, description: e.target.value } })
                    }
                  />
                </div>

                <FileField
                  kind="excel"
                  required={!edit.id}
                  label={
                    edit.id
                      ? "Ganti File Data Tarikan i-BOS (kosongkan jika tidak diganti)"
                      : "File Data Arsip Tarikan i-BOS (.xlsx / .pdf)"
                  }
                  hint={`Format .xlsx atau .pdf · maks. ${maxMb} MB · untuk Excel, isi tabel dapat langsung dilihat dan diunduh oleh SPBU`}
                  accept=".xlsx,.pdf"
                  files={files}
                  onChange={setFiles}
                />
              </div>
            )}
          </Modal>

          <ConfirmModal
            open={!!toggleItem}
            onClose={() => setToggleItem(null)}
            busy={busy}
            onConfirm={confirmToggle}
            danger={toggleItem?.status === "Aktif"}
            title={
              toggleItem?.status === "Aktif"
                ? "Nonaktifkan berkas tarikan i-BOS?"
                : "Aktifkan kembali berkas tarikan i-BOS?"
            }
            message={
              toggleItem?.status === "Aktif"
                ? "Berkas yang dinonaktifkan tidak akan terlihat atau dapat diunduh oleh Admin SPBU maupun PIC Region."
                : "Berkas akan kembali terlihat dan dapat diunduh oleh penerima sesuai target distribusi."
            }
          />

          <ConfirmModal
            open={!!deleteItem}
            onClose={() => setDeleteItem(null)}
            busy={busy}
            onConfirm={confirmDelete}
            danger
            confirmLabel="Hapus Permanen"
            title={`Hapus "${deleteItem?.title || ""}"?`}
            message="Data Arsip Tarikan i-BOS ini akan dihapus dari daftar distribusi bulanan."
          />
        </>
      )}
    </div>
  );
}
