"use client";
import { useMemo, useState } from "react";
import { Calendar, Download, Eye, FileSpreadsheet, FileText, Search } from "lucide-react";
import type { IbosExtractItem } from "@/lib/services/ibos";
import { Modal } from "../ui/Modal";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { DemoTag, Empty } from "../ui/kit";
import { fmtDateTime, fmtSize } from "@/lib/format";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtPeriod(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  if (!m) return ym || "-";
  return `${MONTHS_ID[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

export function MonthlyIbosModal({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: IbosExtractItem[];
}) {
  const [period, setPeriod] = useState("");
  const [q, setQ] = useState("");
  const [tableItem, setTableItem] = useState<IbosExtractItem | null>(null);
  const [tableQ, setTableQ] = useState("");
  const [filePreview, setFilePreview] = useState<PreviewTarget | null>(null);

  const periods = useMemo(
    () => Array.from(new Set(items.map((i) => i.period))).sort((a, b) => b.localeCompare(a)),
    [items]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((it) => {
      if (period && it.period !== period) return false;
      if (s && !`${it.title} ${fmtPeriod(it.period)} ${it.file_name} ${it.description}`.toLowerCase().includes(s)) {
        return false;
      }
      return true;
    });
  }, [items, period, q]);

  const modalRows = useMemo(() => {
    if (!tableItem) return [];
    const s = tableQ.trim().toLowerCase();
    if (!s) return tableItem.rows;
    return tableItem.rows.filter((r) => r.some((c) => c.toLowerCase().includes(s)));
  }, [tableItem, tableQ]);

  return (
    <>
      <Modal
        open={open}
        wide
        onClose={onClose}
        title="Data Arsip Per Bulan (Tarikan i-BOS dari Admin GS)"
        footer={
          <button className="btn-ghost" onClick={onClose}>
            Tutup
          </button>
        }
      >
        <div className="space-y-4">
          <p className="rounded-xl bg-softblue/70 p-3 text-xs text-navy ring-1 ring-blue-100">
            Unduh data arsip bulanan di bawah ini sebagai acuan menyusun <b>Daftar Arsip Usul Musnah</b> SPBU Anda.
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-bold text-navy">
              <Calendar className="h-3.5 w-3.5 text-brand" />
              Bulan:
            </span>
            <button
              type="button"
              onClick={() => setPeriod("")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                period === "" ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"
              }`}
            >
              Semua ({items.length})
            </button>
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                  period === p ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"
                }`}
              >
                {fmtPeriod(p)}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9 text-sm"
              placeholder="Cari judul data arsip atau periode bulan…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <Empty title="Belum ada Data Arsip Per Bulan" text="Admin GS belum membagikan berkas pada periode yang dipilih." />
          ) : (
            <div className="scroll-thin max-h-[52vh] space-y-2.5 overflow-y-auto pr-1">
              {filtered.map((it) => {
                const isExcel = it.file_name.toLowerCase().endsWith(".xlsx");
                return (
                  <div
                    key={it.extract_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 transition hover:border-brand/40"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
                          isExcel ? "bg-prtgreen" : "bg-prtred"
                        }`}
                      >
                        {isExcel ? <FileSpreadsheet className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="chip bg-softblue text-brand ring-blue-100">{fmtPeriod(it.period)}</span>
                          <span className="chip bg-slate-100 text-navy ring-slate-200">{it.target_label}</span>
                          {it.total_rows > 0 && (
                            <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
                              {it.total_rows} baris
                            </span>
                          )}
                          {it.is_demo && <DemoTag />}
                        </div>
                        <div className="mt-1 font-bold text-navy">{it.title}</div>
                        {it.description && <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>}
                        <div className="mt-1 text-[11px] text-slate-400">
                          {it.file_name} · {fmtSize(it.size)} · {fmtDateTime(it.uploaded_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        className="btn-ghost btn-sm ring-1 ring-slate-200"
                        onClick={() => {
                          if (it.headers.length > 0 && it.rows.length > 0) {
                            setTableQ("");
                            setTableItem(it);
                          } else {
                            setFilePreview({ kind: "ibos", id: it.extract_id, name: it.file_name, mime: it.mime });
                          }
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        Preview
                      </button>
                      <a href={`/api/files/ibos/${it.extract_id}?download=1`} className="btn-primary btn-sm">
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!tableItem}
        wide
        onClose={() => setTableItem(null)}
        title={tableItem ? `${tableItem.title} (${fmtPeriod(tableItem.period)})` : "Isi Tabel"}
        footer={
          tableItem ? (
            <>
              <button className="btn-ghost" onClick={() => setTableItem(null)}>
                Kembali
              </button>
              <a className="btn-primary" href={`/api/files/ibos/${tableItem.extract_id}?download=1`}>
                <Download className="h-4 w-4" />
                Download Excel (.xlsx)
              </a>
            </>
          ) : undefined
        }
      >
        {tableItem && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Menampilkan <b>{modalRows.length}</b> dari <b>{tableItem.total_rows}</b> baris.
              </span>
              <input
                className="input w-64 py-1.5 text-xs"
                placeholder="Cari di dalam tabel…"
                value={tableQ}
                onChange={(e) => setTableQ(e.target.value)}
              />
            </div>
            <div className="scroll-thin max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-navy text-white">
                  <tr>
                    {tableItem.headers.map((h, i) => (
                      <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-bold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {modalRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-softblue/40">
                      {tableItem.headers.map((_, cIdx) => (
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
      </Modal>

      <FilePreview target={filePreview} onClose={() => setFilePreview(null)} />
    </>
  );
}
