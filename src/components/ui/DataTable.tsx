"use client";
import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Empty } from "./kit";

export interface Col<T> {
  key: string;
  header: string;
  align?: "right" | "center";
  render?: (r: T) => ReactNode;
  value?: (r: T) => string | number; // untuk sort & ekspor
  sortable?: boolean;
  className?: string;
}
export interface Filter<T> { label: string; get: (r: T) => string; options?: string[] }

export function DataTable<T extends Record<string, any>>({
  rows, columns, filters = [], searchPlaceholder = "Cari…", pageSize = 10, rowHref, emptyTitle = "Belum ada data", emptyText, toolbar, exportName, rowKey,
}: {
  rows: T[]; columns: Col<T>[]; filters?: Filter<T>[]; searchPlaceholder?: string; pageSize?: number; rowHref?: (r: T) => string;
  emptyTitle?: string; emptyText?: string; toolbar?: ReactNode; exportName?: string; rowKey: (r: T) => string;
}) {
  const [q, setQ] = useState("");
  const [fv, setFv] = useState<Record<number, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const val = (c: Col<T>, r: T) => (c.value ? c.value(r) : (r[c.key] ?? "")) as string | number;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let out = rows.filter((r) => (!s || columns.some((c) => String(val(c, r)).toLowerCase().includes(s))) && filters.every((f, i) => !fv[i] || f.get(r) === fv[i]));
    if (sort) {
      const c = columns.find((x) => x.key === sort.key)!;
      out = [...out].sort((a, b) => {
        const x = val(c, a), y = val(c, b);
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "id", { numeric: true })) * sort.dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, fv, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.map((c) => esc(c.header)).join(","), ...filtered.map((r) => columns.map((c) => esc(val(c, r))).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${exportName || "data"}.csv`;
    a.click();
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari" />
        </div>
        {filters.map((f, i) => {
          const opts = f.options ?? [...new Set(rows.map(f.get))].filter(Boolean).sort();
          return (
            <select key={i} className="input w-auto max-w-[200px]" aria-label={f.label} value={fv[i] || ""} onChange={(e) => { setFv({ ...fv, [i]: e.target.value }); setPage(1); }}>
              <option value="">{f.label}: Semua</option>
              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          );
        })}
        {toolbar}
        {exportName && <button className="btn-ghost btn-sm" onClick={exportCsv} title="Unduh data yang terfilter (CSV)"><Download className="h-4 w-4" />CSV</button>}
      </div>
      {filtered.length === 0 ? (
        <Empty title={rows.length ? "Tidak ada hasil" : emptyTitle} text={rows.length ? "Coba ubah kata kunci atau filter pencarian." : emptyText} />
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`th ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""}`}>
                    <button className="inline-flex items-center gap-1 uppercase" onClick={() => setSort(sort?.key === c.key ? { key: c.key, dir: sort.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 })}>
                      {c.header}
                      {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slice.map((r) => (
                <tr key={rowKey(r)} className="transition hover:bg-softblue/40">
                  {columns.map((c, i) => (
                    <td key={c.key} className={`td ${c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""} ${c.className || ""}`}>
                      {i === 0 && rowHref ? <Link href={rowHref(r)} className="font-semibold text-brand hover:underline">{c.render ? c.render(r) : String(val(c, r))}</Link> : c.render ? c.render(r) : String(val(c, r) || "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span>{filtered.length} data{filtered.length !== rows.length ? ` (dari ${rows.length})` : ""}</span>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40" disabled={cur <= 1} onClick={() => setPage(cur - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-2 font-semibold text-navy">{cur} / {pages}</span>
          <button className="rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40" disabled={cur >= pages} onClick={() => setPage(cur + 1)} aria-label="Halaman berikutnya"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
