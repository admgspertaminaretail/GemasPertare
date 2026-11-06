"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDown, ArrowLeft, ArrowUp, Building2, CheckCircle2, ClipboardCheck, Clock, FileEdit,
  FileStack, Filter, Layers, ListOrdered, MapPin, Send, Store, X,
} from "lucide-react";
import { StatusBadge } from "../ui/kit";
import { DataTable } from "../ui/DataTable";
import { STATUS, STATUS_LIST } from "@/lib/constants";

type Data = Awaited<ReturnType<typeof import("@/lib/services/monitoring").getDashboard>>;
type SubRow = Data["subRows"][number];
type SpbuRow = Data["spbuRows"][number];

interface ViewDef {
  key: string;
  label: string;
  shortLabel?: string;
  group: "spbu" | "sub" | "chart";
  kind: "spbu" | "sub";
  tone: string;
  activeCls: string;
  icon: React.ReactNode;
  description: string;
  spbuPred?: (r: SpbuRow) => boolean;
  subPred?: (r: SubRow) => boolean;
}

const inReview = (st: string) => st === STATUS.UPLOADED || st === STATUS.REVIEW;
const isApprovedUp = (st: string) => st === STATUS.APPROVED || st === STATUS.POOLED || st === STATUS.MEMOED;
const isPoolUp = (st: string) => st === STATUS.POOLED || st === STATUS.MEMOED;

export function MonitoringDetailView({
  data,
  role,
  filters,
  initialView,
  initialFocusRegion,
}: {
  data: Data;
  role: string;
  filters: Record<string, string>;
  initialView?: string;
  initialFocusRegion?: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const [f, setF] = useState(filters);
  const isHO = data.scope === "HO";
  const defaultKey = data.scope === "SPBU" ? "total" : "totalSpbu";

  const views: ViewDef[] = useMemo(() => [
    // --- Poin Utama SPBU (Unit Unik) ---
    {
      key: "totalSpbu",
      label: data.scope === "REGION" ? "Total SPBU dalam Region" : "Total SPBU",
      group: "spbu",
      kind: "spbu",
      tone: "text-navy bg-slate-100",
      activeCls: "bg-navy text-white ring-navy shadow-card",
      icon: <Store className="h-4 w-4" />,
      description: "Daftar seluruh unit SPBU aktif beserta total pengajuan, jumlah baris arsip (Excel), FUPA, dan MEMO.",
      spbuPred: () => true,
    },
    {
      key: "spbuSubmitted",
      label: "SPBU Sudah Mengajukan",
      group: "spbu",
      kind: "spbu",
      tone: "text-brand bg-softblue",
      activeCls: "bg-brand text-white ring-brand shadow-card",
      icon: <ClipboardCheck className="h-4 w-4" />,
      description: "Daftar SPBU unik yang sudah memiliki minimal satu transaksi pengajuan usul musnah arsip.",
      spbuPred: (r) => r.total > 0,
    },
    {
      key: "spbuNotSubmitted",
      label: "SPBU Belum Mengajukan",
      group: "spbu",
      kind: "spbu",
      tone: "text-slate-600 bg-slate-100",
      activeCls: "bg-slate-700 text-white ring-slate-700 shadow-card",
      icon: <Building2 className="h-4 w-4" />,
      description: "Daftar SPBU aktif yang belum pernah mengirimkan pengajuan usul musnah arsip.",
      spbuPred: (r) => r.total === 0,
    },
    {
      key: "spbuDone",
      label: "SPBU Selesai Musnah (Di-Memo)",
      group: "spbu",
      kind: "spbu",
      tone: "text-emerald-700 bg-emerald-50",
      activeCls: "bg-prtgreen text-white ring-prtgreen shadow-card",
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: "SPBU unik yang telah menyelesaikan proses usul musnah hingga status akhir “Sudah Di-Memo”.",
      spbuPred: (r) => r.memoedCount > 0,
    },
    {
      key: "spbuNotDone",
      label: "SPBU Belum Selesai Musnah",
      group: "chart",
      kind: "spbu",
      tone: "text-slate-600 bg-slate-100",
      activeCls: "bg-slate-700 text-white ring-slate-700 shadow-card",
      icon: <Building2 className="h-4 w-4" />,
      description: "SPBU yang belum memiliki pengajuan dengan status akhir “Sudah Di-Memo”.",
      spbuPred: (r) => r.memoedCount === 0,
    },

    // --- Poin Utama Transaksi Pengajuan ---
    {
      key: "total",
      label: "Total Transaksi Pengajuan",
      group: "sub",
      kind: "sub",
      tone: "text-brand bg-softblue",
      activeCls: "bg-brand text-white ring-brand shadow-card",
      icon: <FileStack className="h-4 w-4" />,
      description: "Seluruh transaksi pengajuan usul musnah arsip terintegrasi dengan Daftar Arsip (Excel), FUPA, dan MEMO.",
      subPred: () => true,
    },
    {
      key: "review",
      label: "Menunggu Review",
      group: "sub",
      kind: "sub",
      tone: "text-amber-700 bg-amber-50",
      activeCls: "bg-amber-500 text-white ring-amber-500 shadow-card",
      icon: <Clock className="h-4 w-4" />,
      description: "Pengajuan berstatus “Dokumen Terunggah” atau “PIC Region Perlu Review” yang menunggu pemeriksaan PIC Region.",
      subPred: (r) => inReview(r.status),
    },
    {
      key: "revision",
      label: "Perlu Revisi",
      group: "sub",
      kind: "sub",
      tone: "text-prtred bg-red-50",
      activeCls: "bg-prtred text-white ring-prtred shadow-card",
      icon: <FileEdit className="h-4 w-4" />,
      description: "Pengajuan yang dikembalikan ke SPBU untuk revisi/perbaikan kelengkapan dokumen.",
      subPred: (r) => r.status === STATUS.REVISION,
    },
    {
      key: "approved",
      label: "Disetujui (Belum Pooling)",
      group: "sub",
      kind: "sub",
      tone: "text-emerald-700 bg-emerald-50",
      activeCls: "bg-prtgreen text-white ring-prtgreen shadow-card",
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: "Pengajuan yang telah disetujui PIC Region dan siap digabungkan ke dalam Pooling FUPA.",
      subPred: (r) => r.status === STATUS.APPROVED,
    },
    {
      key: "pooled",
      label: "Sudah Masuk Pooling",
      group: "sub",
      kind: "sub",
      tone: "text-brand bg-softblue",
      activeCls: "bg-brand text-white ring-brand shadow-card",
      icon: <Layers className="h-4 w-4" />,
      description: "Pengajuan yang sudah masuk dokumen Pooling FUPA Regional namun belum diterbitkan MEMO.",
      subPred: (r) => r.status === STATUS.POOLED,
    },
    {
      key: "memoed",
      label: "Sudah Di-Memo",
      group: "sub",
      kind: "sub",
      tone: "text-navy bg-slate-100",
      activeCls: "bg-navy text-white ring-navy shadow-card",
      icon: <Send className="h-4 w-4" />,
      description: "Pengajuan usul musnah yang sudah tercantum dalam dokumen MEMO Regional.",
      subPred: (r) => r.status === STATUS.MEMOED,
    },

    // --- Poin Tambahan dari Grafik Progres & Status ---
    {
      key: "statusUploaded",
      label: `Status: ${STATUS.UPLOADED}`,
      group: "chart",
      kind: "sub",
      tone: "text-slate-600 bg-slate-100",
      activeCls: "bg-slate-700 text-white ring-slate-700 shadow-card",
      icon: <Clock className="h-4 w-4" />,
      description: "Pengajuan yang baru diunggah oleh SPBU.",
      subPred: (r) => r.status === STATUS.UPLOADED,
    },
    {
      key: "statusReview",
      label: `Status: ${STATUS.REVIEW}`,
      group: "chart",
      kind: "sub",
      tone: "text-amber-700 bg-amber-50",
      activeCls: "bg-amber-500 text-white ring-amber-500 shadow-card",
      icon: <Clock className="h-4 w-4" />,
      description: "Pengajuan berstatus spesifik “PIC Region Perlu Review” pada grafik perbandingan status.",
      subPred: (r) => r.status === STATUS.REVIEW,
    },
    {
      key: "approvedCumulative",
      label: "Disetujui (Kumulatif)",
      group: "chart",
      kind: "sub",
      tone: "text-emerald-700 bg-emerald-50",
      activeCls: "bg-prtgreen text-white ring-prtgreen shadow-card",
      icon: <CheckCircle2 className="h-4 w-4" />,
      description: "Seluruh pengajuan yang sudah melewati persetujuan (Disetujui + Sudah Masuk Pooling + Sudah Di-Memo).",
      subPred: (r) => isApprovedUp(r.status),
    },
    {
      key: "pooledCumulative",
      label: "Sudah Pooling (Kumulatif)",
      group: "chart",
      kind: "sub",
      tone: "text-brand bg-softblue",
      activeCls: "bg-brand text-white ring-brand shadow-card",
      icon: <Layers className="h-4 w-4" />,
      description: "Seluruh pengajuan yang sudah masuk Pooling FUPA (baik yang masih Pooling maupun yang sudah Di-Memo).",
      subPred: (r) => isPoolUp(r.status),
    },
    {
      key: "memoForwarded",
      label: "MEMO Diteruskan ke PAM",
      group: "chart",
      kind: "sub",
      tone: "text-emerald-700 bg-emerald-50",
      activeCls: "bg-prtgreen text-white ring-prtgreen shadow-card",
      icon: <Send className="h-4 w-4" />,
      description: `Pengajuan dengan dokumen MEMO Regional yang telah diteruskan ke PAM (${data.memoProgress.forwarded} dokumen MEMO). Satu MEMO dapat mencakup beberapa pengajuan sekaligus.`,
      subPred: (r) => r.forward === "Sudah Diteruskan",
    },
    {
      key: "memoNotForwarded",
      label: "MEMO Belum Diteruskan",
      group: "chart",
      kind: "sub",
      tone: "text-prtred bg-red-50",
      activeCls: "bg-prtred text-white ring-prtred shadow-card",
      icon: <Send className="h-4 w-4" />,
      description: `Pengajuan yang sudah berstatus MEMO namun belum diteruskan ke PAM (${data.memoProgress.notForwarded} dokumen MEMO).`,
      subPred: (r) => r.forward === "Belum Diteruskan",
    },
  ], [data.scope, data.memoProgress.forwarded, data.memoProgress.notForwarded]);

  const resolveKey = (k?: string) => (k && views.some((v) => v.key === k) ? k : defaultKey);
  const [activeKey, setActiveKey] = useState(() => resolveKey(initialView));
  const [focusRegion, setFocusRegion] = useState(initialFocusRegion || "");
  const [chronoDir, setChronoDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setActiveKey(resolveKey(initialView));
    setFocusRegion(initialFocusRegion || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView, initialFocusRegion]);

  useEffect(() => {
    setF(filters);
  }, [filters]);

  const buildQuery = (nextFilters: Record<string, string>, nextView: string, nextFocusRegion: string) => {
    const p = new URLSearchParams();
    if (nextView) p.set("view", nextView);
    if (nextFocusRegion) p.set("focusRegion", nextFocusRegion);
    Object.entries(nextFilters).forEach(([a, b]) => b && p.set(a, b));
    return p.toString();
  };

  const selectView = (nextKey: string) => {
    setActiveKey(nextKey);
    if (typeof window !== "undefined") {
      const qs = buildQuery(filters, nextKey, focusRegion);
      window.history.replaceState(null, "", `${path}${qs ? "?" + qs : ""}`);
    }
  };

  const clearFocusRegion = () => {
    setFocusRegion("");
    if (typeof window !== "undefined") {
      const qs = buildQuery(filters, activeKey, "");
      window.history.replaceState(null, "", `${path}${qs ? "?" + qs : ""}`);
    }
  };

  const applyFilters = (next = f) => {
    const qs = buildQuery(next, activeKey, focusRegion);
    router.push(`${path}${qs ? "?" + qs : ""}`);
  };

  const resetFilters = () => {
    setF({});
    setFocusRegion("");
    router.push(`${path}?view=${activeKey}`);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const setField = (key: string, v: string) => setF((s) => ({ ...s, [key]: v, ...(key === "region" ? { spbu: "" } : {}) }));

  // Hitung jumlah item per kategori (memperhitungkan focusRegion bila dipilih dari grafik batang Region)
  const countFor = (v: ViewDef) => {
    if (v.kind === "spbu") {
      return data.spbuRows.filter((r) => (!focusRegion || r.region_id === focusRegion) && (v.spbuPred ? v.spbuPred(r) : true)).length;
    }
    return data.subRows.filter((r) => (!focusRegion || r.region_id === focusRegion) && (v.subPred ? v.subPred(r) : true)).length;
  };

  const currentView = views.find((v) => v.key === activeKey) || views[0];
  const focusRegionName = focusRegion ? data.regions.find((r) => r.region_id === focusRegion)?.region_name || focusRegion : "";

  const spbuFiltered = useMemo(
    () => (currentView.kind === "spbu"
      ? data.spbuRows.filter((r) => (!focusRegion || r.region_id === focusRegion) && (currentView.spbuPred ? currentView.spbuPred(r) : true))
      : []),
    [currentView, data.spbuRows, focusRegion]
  );

  const subFiltered = useMemo(() => {
    if (currentView.kind !== "sub") return [];
    const base = data.subRows.filter((r) => (!focusRegion || r.region_id === focusRegion) && (currentView.subPred ? currentView.subPred(r) : true));
    return chronoDir === "asc" ? base : [...base].reverse();
  }, [currentView, data.subRows, focusRegion, chronoDir]);

  const spbuSummary = currentView.kind === "spbu" ? {
    spbu: spbuFiltered.length,
    subs: spbuFiltered.reduce((a, r) => a + r.total, 0),
    arsip: spbuFiltered.reduce((a, r) => a + r.arsipTotal, 0),
    done: spbuFiltered.filter((r) => r.memoedCount > 0).length,
  } : null;

  const subSummary = currentView.kind === "sub" ? {
    subs: subFiltered.length,
    spbu: new Set(subFiltered.map((r) => r.spbu_id)).size,
    arsip: subFiltered.reduce((a, r) => a + r.arsip, 0),
    fupa: new Set(subFiltered.map((r) => r.fupa).filter(Boolean)).size,
    memo: new Set(subFiltered.map((r) => r.memo).filter(Boolean)).size,
  } : null;

  // URL kembali ke Dashboard dengan filter yang sama tetap terjaga
  const backParams = new URLSearchParams();
  Object.entries(filters).forEach(([a, b]) => b && backParams.set(a, b));
  const dashboardHref = `/dashboard${backParams.toString() ? "?" + backParams.toString() : ""}`;

  const spbuGroup = views.filter((v) => v.group === "spbu" && (data.scope !== "SPBU" || v.key === "totalSpbu"));
  const subGroup = views.filter((v) => v.group === "sub");
  const chartGroup = views.filter((v) => v.group === "chart" && (data.scope !== "SPBU" || v.kind === "sub"));

  return (
    <div className="space-y-5">
      {/* Baris navigasi balik cepat & filter global */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={dashboardHref} className="btn-ghost btn-sm">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Grafik Dashboard
          </Link>
          <Link href="/kronologis-pengajuan" className="btn-ghost btn-sm text-brand">
            <ListOrdered className="h-4 w-4" />
            Buka Menu Kronologis ID Pengajuan
          </Link>
        </div>
        {focusRegion && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-softblue px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-blue-200">
            <MapPin className="h-3.5 w-3.5" />
            Fokus Grafik: {focusRegionName}
            <button type="button" onClick={clearFocusRegion} className="ml-1 rounded-md p-0.5 hover:bg-blue-100" title="Tampilkan semua Region">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {data.scope !== "SPBU" && (
        <form className="card flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
          <Filter className="mb-2.5 h-4 w-4 text-slate-400" />
          <div>
            <label className="label" htmlFor="d-fy">Tahun</label>
            <select id="d-fy" className="input w-28" value={f.year || ""} onChange={(e) => setField("year", e.target.value)}>
              <option value="">Semua</option>
              {data.years.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
          {role === "ADMIN_PAM" && (
            <div>
              <label className="label" htmlFor="d-fr">Region</label>
              <select id="d-fr" className="input w-40" value={f.region || ""} onChange={(e) => setField("region", e.target.value)}>
                <option value="">Semua Region</option>
                {data.regions.map((r) => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label" htmlFor="d-fs">SPBU</label>
            <select id="d-fs" className="input w-56" value={f.spbu || ""} onChange={(e) => setField("spbu", e.target.value)}>
              <option value="">Semua SPBU</option>
              {data.spbuOptions.map((s) => <option key={s.id} value={s.id}>{s.name.replace("SPBU-", "")}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="d-fsid">ID Pengajuan</label>
            <input id="d-fsid" className="input w-36 font-mono" placeholder="SUB-0001…" value={f.subId || ""} onChange={(e) => setField("subId", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="d-fst">Status</label>
            <select id="d-fst" className="input w-52" value={f.status || ""} onChange={(e) => setField("status", e.target.value)}>
              <option value="">Semua status</option>
              {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="d-ff">Nomor FUPA</label>
            <input id="d-ff" className="input w-40" placeholder="cari…" value={f.fupa || ""} onChange={(e) => setField("fupa", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="d-fm">Nomor MEMO</label>
            <input id="d-fm" className="input w-40" placeholder="cari…" value={f.memo || ""} onChange={(e) => setField("memo", e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary">Terapkan</button>
            {hasActiveFilters && (
              <button type="button" className="btn-ghost" onClick={resetFilters}>
                <X className="h-4 w-4" />Reset
              </button>
            )}
          </div>
        </form>
      )}

      {/* Pemilih Poin Informasi Dashboard */}
      <div className="card space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-2">
          {spbuGroup.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Poin Unit SPBU (Unik)
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {spbuGroup.map((v) => {
                  const active = v.key === currentView.key;
                  const cnt = countFor(v);
                  return (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => selectView(v.key)}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold ring-1 transition ${
                        active ? v.activeCls : "bg-white text-navy ring-slate-200/80 hover:bg-softblue/50 hover:ring-brand/30"
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white/20 text-white" : v.tone}`}>
                          {v.icon}
                        </span>
                        <span className="truncate">{v.label}</span>
                      </span>
                      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-sm font-extrabold tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-navy"}`}>
                        {cnt}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Poin Transaksi Pengajuan &amp; Status
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {subGroup.map((v) => {
                const active = v.key === currentView.key;
                const cnt = countFor(v);
                return (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => selectView(v.key)}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold ring-1 transition ${
                      active ? v.activeCls : "bg-white text-navy ring-slate-200/80 hover:bg-softblue/50 hover:ring-brand/30"
                    }`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white/20 text-white" : v.tone}`}>
                        {v.icon}
                      </span>
                      <span className="truncate">{v.label}</span>
                    </span>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-sm font-extrabold tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-navy"}`}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kategori rincian grafik lanjutan */}
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Rincian Segmen Grafik Lanjutan (Kumulatif Pooling, Penerusan MEMO, &amp; Status Spesifik)
          </div>
          <div className="flex flex-wrap gap-2">
            {chartGroup.map((v) => {
              const active = v.key === currentView.key;
              const cnt = countFor(v);
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => selectView(v.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                    active ? v.activeCls : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-softblue/50 hover:text-navy"
                  }`}
                >
                  {v.label}
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums ${active ? "bg-white/20 text-white" : "bg-white text-navy ring-1 ring-slate-200/70"}`}>
                    {cnt}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Header Rincian Aktif + Ringkasan Angka Terintegrasi */}
      <div className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-extrabold text-navy">
              {currentView.label}
              {focusRegionName ? ` — ${focusRegionName}` : ""}
            </h2>
            <span className="chip bg-softblue text-brand ring-blue-200">
              {currentView.kind === "spbu" ? `${spbuFiltered.length} SPBU` : `${subFiltered.length} Pengajuan`}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{currentView.description}</p>
        </div>

        {spbuSummary && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip bg-softblue text-navy ring-blue-100">{spbuSummary.spbu} Unit SPBU</span>
            <span className="chip bg-blue-50 text-brand ring-blue-200">{spbuSummary.subs} Total Pengajuan</span>
            <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
              {spbuSummary.arsip.toLocaleString("id-ID")} Baris Arsip (Excel)
            </span>
            <span className="chip bg-navy text-white ring-navy">{spbuSummary.done} SPBU Selesai (Di-Memo)</span>
          </div>
        )}

        {subSummary && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="chip bg-softblue text-navy ring-blue-100">{subSummary.subs} Transaksi Pengajuan</span>
            <span className="chip bg-blue-50 text-brand ring-blue-200">{subSummary.spbu} SPBU Unik</span>
            <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
              {subSummary.arsip.toLocaleString("id-ID")} Baris Arsip (Excel)
            </span>
            {subSummary.fupa > 0 && <span className="chip bg-amber-50 text-amber-800 ring-amber-200">{subSummary.fupa} FUPA</span>}
            {subSummary.memo > 0 && <span className="chip bg-navy text-white ring-navy">{subSummary.memo} MEMO</span>}
          </div>
        )}
      </div>

      {/* Tabel Data Penuh (Full-Page) */}
      {currentView.kind === "spbu" ? (
        <DataTable
          key={`spbu-${currentView.key}-${focusRegion}`}
          rows={spbuFiltered}
          rowKey={(r) => r.spbu_id}
          exportName={`rincian-${currentView.key}`}
          pageSize={20}
          searchPlaceholder="Cari nama SPBU, kode SPBU, ID Pengajuan (SUB-0001…), kota, Region, FUPA, atau MEMO…"
          rowHref={(r) => `/dashboard/spbu/${r.spbu_id}`}
          filters={[
            ...(isHO && !focusRegion ? [{ label: "Region", get: (r: SpbuRow) => r.region_name }] : []),
            { label: "Status Terakhir", get: (r: SpbuRow) => r.lastStatus, options: [...STATUS_LIST, "Belum mengajukan"] },
          ]}
          columns={[
            {
              key: "name",
              header: "SPBU",
              render: (r) => (
                <span>
                  {r.name}
                  <span className="block text-[11px] font-normal text-slate-400">
                    {r.spbu_code}{r.city ? ` · ${r.city}` : ""}
                  </span>
                </span>
              ),
              value: (r) => `${r.name} ${r.spbu_code} ${r.city}`,
            },
            ...(isHO ? [{ key: "region_name", header: "Region" }] : []),
            {
              key: "submissionIdsText",
              header: "ID Pengajuan",
              render: (r) => (r.submissionIds.length ? (
                <div className="flex flex-wrap gap-1">
                  {r.submissionIds.map((sid) => (
                    <Link
                      key={sid}
                      href={`/submissions/${sid}`}
                      className="rounded-md bg-softblue px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand ring-1 ring-blue-200/70 transition hover:bg-brand hover:text-white"
                    >
                      {sid}
                    </Link>
                  ))}
                </div>
              ) : <span className="text-xs text-slate-300">-</span>),
              value: (r) => r.submissionIdsText || "ZZZ",
            },
            { key: "total", header: "Total Pengajuan", align: "right" as const },
            { key: "arsipTotal", header: "Baris Arsip (Excel)", align: "right" as const },
            { key: "memoedCount", header: "Selesai (Di-Memo)", align: "right" as const },
            {
              key: "lastStatus",
              header: "Status Terakhir",
              render: (r) => (r.total ? <StatusBadge status={r.lastStatus} /> : <span className="text-xs text-slate-400">Belum mengajukan</span>),
            },
            { key: "lastDate", header: "Tgl Pengajuan Terakhir" },
            { key: "fupa", header: "Nomor FUPA" },
            {
              key: "memo",
              header: "Nomor MEMO",
              render: (r) => (r.memo ? (
                <span>
                  {r.memo}
                  {r.memoDate && <span className="block text-[11px] text-slate-400">{r.memoDate}</span>}
                </span>
              ) : "-"),
              value: (r) => r.memo,
            },
          ]}
        />
      ) : (
        <DataTable
          key={`sub-${currentView.key}-${focusRegion}-${chronoDir}`}
          rows={subFiltered}
          rowKey={(r) => r.submission_id}
          exportName={`rincian-${currentView.key}`}
          pageSize={20}
          searchPlaceholder="Cari ID pengajuan (SUB-0001…), nama/kode SPBU, kota, nomor FUPA, nomor MEMO, atau keterangan…"
          toolbar={
            <button
              type="button"
              onClick={() => setChronoDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="btn-ghost btn-sm text-brand"
              title="Ubah urutan kronologis ID Pengajuan"
            >
              {chronoDir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
              {chronoDir === "asc" ? "Kronologis: Awal → Akhir" : "Kronologis: Terbaru → Awal"}
            </button>
          }
          filters={[
            ...(isHO && !focusRegion ? [{ label: "Region", get: (r: SubRow) => r.region_name }] : []),
            { label: "Status", get: (r: SubRow) => r.status, options: STATUS_LIST },
          ]}
          columns={[
            {
              key: "chrono_no",
              header: "No.",
              align: "right" as const,
              render: (r) => <span className="font-mono text-xs font-bold text-slate-400">#{r.chrono_no}</span>,
              value: (r) => r.chrono_no,
            },
            {
              key: "submission_id",
              header: "ID Pengajuan",
              render: (r) => (
                <Link
                  href={`/submissions/${r.submission_id}`}
                  className="inline-flex items-center rounded-lg bg-softblue px-2.5 py-1 font-mono text-xs font-extrabold text-brand ring-1 ring-blue-200 transition hover:bg-brand hover:text-white"
                >
                  {r.submission_id}
                </Link>
              ),
              value: (r) => r.submission_id,
            },
            {
              key: "submission_date",
              header: "Tanggal",
              render: (r) => <span className="font-mono text-xs font-semibold text-navy">{r.submission_date}</span>,
              value: (r) => r.submission_date,
            },
            {
              key: "spbu_name",
              header: "SPBU",
              render: (r) => (
                <Link href={`/dashboard/spbu/${r.spbu_id}`} className="font-semibold text-navy hover:text-brand hover:underline">
                  {r.spbu_name}
                  <span className="block text-[11px] font-normal text-slate-400">
                    {r.spbu_code}{r.city ? ` · ${r.city}` : ""}
                  </span>
                </Link>
              ),
              value: (r) => `${r.spbu_name} ${r.spbu_code} ${r.city}`,
            },
            ...(isHO ? [{ key: "region_name", header: "Region" }] : []),
            {
              key: "revision_no",
              header: "Revisi",
              align: "center" as const,
              render: (r) => (r.revision_no > 0 ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">R{r.revision_no}</span>
              ) : <span className="text-slate-300">-</span>),
              value: (r) => r.revision_no,
            },
            { key: "arsip", header: "Baris Arsip (Excel)", align: "right" as const },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "fupa", header: "Nomor FUPA" },
            {
              key: "memo",
              header: "Nomor MEMO",
              render: (r) => (r.memo ? (
                <span>
                  {r.memo}
                  {r.memo_date && <span className="block text-[11px] text-slate-400">{r.memo_date}</span>}
                </span>
              ) : "-"),
              value: (r) => r.memo,
            },
            {
              key: "forward",
              header: "MEMO ke PAM",
              render: (r) => (r.forward ? (
                <span>
                  {r.forward}
                  {r.forwarded_date && <span className="block text-[11px] text-slate-400">{r.forwarded_date}</span>}
                </span>
              ) : "-"),
              value: (r) => r.forward,
            },
            {
              key: "description",
              header: "Keterangan",
              render: (r) => <span className="block max-w-[240px] truncate" title={r.description}>{r.description || "-"}</span>,
              value: (r) => r.description,
            },
          ]}
        />
      )}

      <p className="text-xs text-slate-500">
        Klik nama SPBU atau ID Pengajuan pada kolom pertama untuk membuka halaman berkas dan riwayat lengkapnya. Gunakan tombol <b>CSV</b> di kanan atas tabel untuk mengunduh laporan sesuai kategori &amp; filter yang sedang aktif.
      </p>
    </div>
  );
}
