"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Calendar, Hash, ListOrdered, RotateCcw } from "lucide-react";
import { DataTable } from "../ui/DataTable";
import { StatusBadge } from "../ui/kit";
import { STATUS_LIST } from "@/lib/constants";

type Data = Awaited<ReturnType<typeof import("@/lib/services/monitoring").getDashboard>>;
type SubRow = Data["subRows"][number];

export function ChronologicalIdView({ data, initialId = "" }: { data: Data; initialId?: string }) {
  const isHO = data.scope === "HO";
  const [idQuery, setIdQuery] = useState(initialId);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const resetAll = () => {
    setIdQuery("");
    setDateFrom("");
    setDateTo("");
    setRegionFilter("");
    setStatusFilter("");
    setDir("asc");
  };

  const hasFilters = !!(idQuery.trim() || dateFrom || dateTo || regionFilter || statusFilter);

  // Pencocokan pintar ID Pengajuan: ketik "SUB-0012", "0012", maupun "12" langsung cocok
  const matchId = (sid: string, raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return true;
    const low = sid.toLowerCase();
    if (low.includes(q)) return true;
    if (/^\d+$/.test(q)) {
      const num = Number(sid.replace(/\D+/g, ""));
      return num === Number(q) || sid.replace(/\D+/g, "").includes(q);
    }
    return false;
  };

  const rows = useMemo(() => {
    const filtered = data.subRows.filter((r) => {
      if (!matchId(r.submission_id, idQuery)) return false;
      if (dateFrom && r.submission_date < dateFrom) return false;
      if (dateTo && r.submission_date > dateTo) return false;
      if (regionFilter && r.region_id !== regionFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
    return dir === "asc" ? filtered : [...filtered].reverse();
  }, [data.subRows, idQuery, dateFrom, dateTo, regionFilter, statusFilter, dir]);

  const firstItem = data.subRows[0];
  const lastItem = data.subRows[data.subRows.length - 1];
  const totalArsip = rows.reduce((a, r) => a + r.arsip, 0);

  return (
    <div className="space-y-5">
      {/* Ringkasan Kronologis */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ID Pengajuan Terfilter</div>
          <div className="mt-1 text-2xl font-extrabold text-navy">
            {rows.length}
            {rows.length !== data.subRows.length && <span className="ml-1 text-sm font-semibold text-slate-400">/ {data.subRows.length}</span>}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">{new Set(rows.map((r) => r.spbu_id)).size} SPBU unik</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ID Pertama (Awal Kronologi)</div>
          <div className="mt-1 font-mono text-xl font-extrabold text-brand">{firstItem?.submission_id || "-"}</div>
          <div className="mt-0.5 text-xs text-slate-500">{firstItem ? `${firstItem.submission_date} · ${firstItem.spbu_name}` : "Belum ada data"}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ID Terakhir (Terbaru)</div>
          <div className="mt-1 font-mono text-xl font-extrabold text-navy">{lastItem?.submission_id || "-"}</div>
          <div className="mt-0.5 text-xs text-slate-500">{lastItem ? `${lastItem.submission_date} · ${lastItem.spbu_name}` : "Belum ada data"}</div>
        </div>
        <div className="card p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Baris Arsip (Excel)</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{totalArsip.toLocaleString("id-ID")}</div>
          <div className="mt-0.5 text-xs text-slate-500">Akumulasi baris daftar arsip pada hasil filter</div>
        </div>
      </div>

      {/* Panel Pencarian Cepat ID Pengajuan & Filter Kronologis */}
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="cid">Cari Cepat ID Pengajuan</label>
            <div className="relative">
              <Hash className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand" />
              <input
                id="cid"
                className="input pl-9 font-mono font-semibold"
                placeholder="Ketik SUB-0001 atau angka urutan (cth: 12)…"
                value={idQuery}
                onChange={(e) => setIdQuery(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cdf">Dari Tanggal</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input id="cdf" type="date" className="input w-40 pl-8" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="cdt">Sampai Tanggal</label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input id="cdt" type="date" className="input w-40 pl-8" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {isHO && (
            <div>
              <label className="label" htmlFor="crg">Region</label>
              <select id="crg" className="input w-40" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                <option value="">Semua Region</option>
                {data.regions.map((r) => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="cst">Status</label>
            <select id="cst" className="input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Semua Status</option>
              {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <span className="label block">Urutan Kronologis</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDir("asc")}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  dir === "asc" ? "bg-brand text-white shadow-sm" : "text-slate-600 hover:text-navy"
                }`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
                Awal → Akhir
              </button>
              <button
                type="button"
                onClick={() => setDir("desc")}
                className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  dir === "desc" ? "bg-navy text-white shadow-sm" : "text-slate-600 hover:text-navy"
                }`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Terbaru → Awal
              </button>
            </div>
          </div>

          {hasFilters && (
            <button type="button" onClick={resetAll} className="btn-ghost">
              <RotateCcw className="h-4 w-4" />Reset
            </button>
          )}
        </div>
      </div>

      {/* Tabel Indeks Kronologis Berdasarkan ID Pengajuan */}
      <DataTable
        key={`chrono-${dir}-${regionFilter}-${statusFilter}`}
        rows={rows}
        rowKey={(r) => r.submission_id}
        exportName="kronologis-id-pengajuan"
        pageSize={25}
        emptyTitle="ID Pengajuan tidak ditemukan"
        emptyText="Coba ubah nomor ID Pengajuan atau rentang tanggal kronologis di atas."
        searchPlaceholder="Cari tambahan berdasarkan nama/kode SPBU, FUPA, MEMO, atau keterangan…"
        toolbar={
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-softblue px-3 py-1.5 text-xs font-bold text-brand">
            <ListOrdered className="h-4 w-4" />
            {dir === "asc" ? "Urut Kronologis: SUB-0001 → Terbaru" : "Urut Kronologis: Terbaru → SUB-0001"}
          </span>
        }
        columns={[
          {
            key: "chrono_no",
            header: "No.",
            align: "right" as const,
            render: (r: SubRow) => <span className="font-mono text-xs font-bold text-slate-400">#{r.chrono_no}</span>,
            value: (r: SubRow) => r.chrono_no,
          },
          {
            key: "submission_id",
            header: "ID Pengajuan",
            render: (r: SubRow) => (
              <Link
                href={`/submissions/${r.submission_id}`}
                className="inline-flex items-center rounded-lg bg-softblue px-2.5 py-1 font-mono text-xs font-extrabold text-brand ring-1 ring-blue-200 transition hover:bg-brand hover:text-white"
              >
                {r.submission_id}
              </Link>
            ),
            value: (r: SubRow) => r.submission_id,
          },
          {
            key: "submission_date",
            header: "Tgl Pengajuan",
            render: (r: SubRow) => <span className="font-mono text-xs font-semibold text-navy">{r.submission_date}</span>,
            value: (r: SubRow) => r.submission_date,
          },
          {
            key: "spbu_name",
            header: "SPBU",
            render: (r: SubRow) => (
              <Link href={`/dashboard/spbu/${r.spbu_id}`} className="font-semibold text-navy hover:text-brand hover:underline">
                {r.spbu_name}
                <span className="block text-[11px] font-normal text-slate-400">
                  {r.spbu_code}{r.city ? ` · ${r.city}` : ""}
                </span>
              </Link>
            ),
            value: (r: SubRow) => `${r.spbu_name} ${r.spbu_code} ${r.city}`,
          },
          ...(isHO ? [{ key: "region_name", header: "Region" }] : []),
          {
            key: "revision_no",
            header: "Revisi",
            align: "center" as const,
            render: (r: SubRow) => (r.revision_no > 0 ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">R{r.revision_no}</span> : <span className="text-slate-300">-</span>),
            value: (r: SubRow) => r.revision_no,
          },
          { key: "arsip", header: "Baris Arsip", align: "right" as const },
          { key: "status", header: "Status Terakhir", render: (r: SubRow) => <StatusBadge status={r.status} /> },
          {
            key: "fupa",
            header: "Pooling FUPA",
            render: (r: SubRow) => (r.fupa ? (
              <span>
                {r.fupa}
                {r.pooling_date && <span className="block font-mono text-[11px] text-slate-400">{r.pooling_date}</span>}
              </span>
            ) : "-"),
            value: (r: SubRow) => r.fupa,
          },
          {
            key: "memo",
            header: "MEMO Regional",
            render: (r: SubRow) => (r.memo ? (
              <span>
                {r.memo}
                {r.memo_date && <span className="block font-mono text-[11px] text-slate-400">{r.memo_date}</span>}
              </span>
            ) : "-"),
            value: (r: SubRow) => r.memo,
          },
          {
            key: "forward",
            header: "MEMO ke PAM",
            render: (r: SubRow) => (r.forward ? (
              <span>
                {r.forward}
                {r.forwarded_date && <span className="block font-mono text-[11px] text-slate-400">{r.forwarded_date}</span>}
              </span>
            ) : "-"),
            value: (r: SubRow) => r.forward,
          },
          {
            key: "updated_at",
            header: "Update Terakhir",
            render: (r: SubRow) => <span className="font-mono text-xs text-slate-500">{r.updated_at || "-"}</span>,
            value: (r: SubRow) => r.updated_at,
          },
        ]}
      />
    </div>
  );
}
