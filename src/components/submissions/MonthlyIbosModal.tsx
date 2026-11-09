"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Search,
} from "lucide-react";
import type { IbosExtractItem } from "@/lib/services/ibos";
import { Modal } from "../ui/Modal";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { DemoTag, Empty } from "../ui/kit";
import { fmtDateTime, fmtPeriod, fmtSize } from "@/lib/format";

export function MonthlyIbosModal({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: IbosExtractItem[];
}) {
  const [tableQ, setTableQ] = useState("");
  const [filePreview, setFilePreview] = useState<PreviewTarget | null>(null);

  // Mengambil data tarikan i-BOS bulan aktif / terbaru yang diperbarui oleh Back Office (Admin GS)
  const latestItem = items[0] || null;

  const modalRows = useMemo(() => {
    if (!latestItem) return [];
    const s = tableQ.trim().toLowerCase();
    if (!s) return latestItem.rows;
    return latestItem.rows.filter((r) => r.some((c) => c.toLowerCase().includes(s)));
  }, [latestItem, tableQ]);

  return (
    <>
      <Modal
        open={open}
        wide
        onClose={onClose}
        title="Data Arsip Tarikan i-BOS (Bulan Ini)"
        footer={
          latestItem ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Diperbarui bulanan oleh Back Office (Admin GS)
              </span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-ghost" onClick={onClose}>
                  Tutup
                </button>
                <a
                  href={`/api/files/ibos/${latestItem.extract_id}?download=1`}
                  className="btn-primary"
                >
                  <Download className="h-4 w-4" />
                  Download File Excel (.xlsx)
                </a>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-ghost" onClick={onClose}>
              Tutup
            </button>
          )
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-softblue/60 p-3.5 text-xs text-navy">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div>
              <p className="font-bold">
                Data Tarikan i-BOS Periode Aktif — {latestItem ? fmtPeriod(latestItem.period) : "Terbaru"}
              </p>
              <p className="mt-0.5 text-slate-600">
                Data tarikan arsip ini diperbarui setiap bulan oleh <b>Back Office (Admin GS)</b>. Anda dapat langsung mengunduh berkas ini sebagai acuan menyusun <b>Daftar Arsip Usul Musnah</b> SPBU Anda.
              </p>
            </div>
          </div>

          {!latestItem ? (
            <Empty
              title="Belum ada Data Tarikan i-BOS"
              text="Back Office (Admin GS) belum mengunggah data tarikan i-BOS untuk periode ini."
            />
          ) : (
            <div className="space-y-4">
              {/* Kartu Ringkasan Berkas Aktif */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                    <FileSpreadsheet className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-extrabold text-brand">
                        Periode {fmtPeriod(latestItem.period)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-navy">
                        {latestItem.target_label}
                      </span>
                      {latestItem.total_rows > 0 && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                          {latestItem.total_rows} baris data
                        </span>
                      )}
                      {latestItem.is_demo && <DemoTag />}
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-navy">{latestItem.title}</div>
                    {latestItem.description && (
                      <p className="mt-0.5 text-xs text-slate-500">{latestItem.description}</p>
                    )}
                    <div className="mt-1 text-[11px] text-slate-400">
                      {latestItem.file_name} · {fmtSize(latestItem.size)} · Diperbarui pada {fmtDateTime(latestItem.uploaded_at)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`/api/files/ibos/${latestItem.extract_id}?download=1`}
                    className="btn-primary shadow-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download Langsung (.xlsx)
                  </a>
                </div>
              </div>

              {/* Area Peninjauan (Preview) Isi Tabel */}
              {latestItem.headers.length > 0 && latestItem.rows.length > 0 && (
                <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Tinjauan Data ({modalRows.length} dari {latestItem.total_rows} baris)
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        className="input w-56 py-1 pl-8 text-xs"
                        placeholder="Cari di data tarikan…"
                        value={tableQ}
                        onChange={(e) => setTableQ(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="scroll-thin max-h-[38vh] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-navy text-white">
                        <tr>
                          {latestItem.headers.map((h, i) => (
                            <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {modalRows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-softblue/40">
                            {latestItem.headers.map((_, cIdx) => (
                              <td key={cIdx} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                                {row[cIdx] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <FilePreview target={filePreview} onClose={() => setFilePreview(null)} />
    </>
  );
}
