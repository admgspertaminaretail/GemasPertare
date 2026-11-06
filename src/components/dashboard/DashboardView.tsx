"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Building2, CheckCircle2, ClipboardCheck, Clock, FileEdit, FileStack, Filter, Layers, Send, Store, X, Plus } from "lucide-react";
import { KpiCard, StatusBadge } from "../ui/kit";
import { DataTable } from "../ui/DataTable";
import { STATUS, STATUS_LIST } from "@/lib/constants";

type Data = Awaited<ReturnType<typeof import("@/lib/services/monitoring").getDashboard>>;
const COLORS: Record<string, string> = {
  [STATUS.UPLOADED]: "#94A3B8", [STATUS.REVIEW]: "#F59E0B", [STATUS.REVISION]: "#E52329",
  [STATUS.APPROVED]: "#69B345", [STATUS.POOLED]: "#006CB7", [STATUS.MEMOED]: "#163B63",
};

function ChartCard({ title, note, children, empty, action }: { title: string; note?: string; children: React.ReactNode; empty?: boolean; action?: React.ReactNode }) {
  return (
    <div className="card clickable-chart p-4 transition hover:shadow-pop">
      <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-navy">{title}</h3>{action}</div>
      <p className="mb-2 text-[11px] text-slate-500">{note ? `${note} · klik grafik untuk buka rincian` : "Klik bagian grafik untuk membuka Rincian Data Monitoring"}</p>
      <div className="h-60">{empty ? <div className="flex h-full items-center justify-center text-sm text-slate-400">Belum ada data untuk ditampilkan</div> : children}</div>
    </div>
  );
}

function Donut({ data, onSelect }: { data: { name: string; value: number; color: string }[]; onSelect?: (name: string) => void }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const visible = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer>
      <PieChart>
        <Pie data={visible} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none"
          onClick={(d: any) => { const n = d?.name ?? d?.payload?.name; if (n) onSelect?.(String(n)); }}>
          {visible.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: number, n: string) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%) — klik untuk buka rincian`, n]} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} onClick={(l: any) => l?.value && onSelect?.(String(l.value))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DashboardView({ data, role, filters, basePath, fixedRegion }: { data: Data; role: string; filters: Record<string, string>; basePath: string; fixedRegion?: string }) {
  const router = useRouter();
  const path = usePathname();
  const [f, setF] = useState(filters);
  const k = data.kpi;
  const isHO = data.scope === "HO";
  const apply = (next = f) => {
    const p = new URLSearchParams();
    Object.entries(next).forEach(([a, b]) => b && p.set(a, b));
    router.push(`${path}${p.toString() ? "?" + p.toString() : ""}`);
  };
  const reset = () => { setF({}); router.push(path); };
  const active = Object.values(filters).some(Boolean);
  const set = (key: string, v: string) => setF((s) => ({ ...s, [key]: v, ...(key === "region" ? { spbu: "" } : {}) }));

  // Bangun URL menuju menu "Rincian Data Monitoring" (/detail-monitoring) sambil membawa filter yang sedang aktif
  const detailUrl = (viewKey: string, extra?: { focusRegion?: string }) => {
    const p = new URLSearchParams();
    p.set("view", viewKey);
    if (extra?.focusRegion) p.set("focusRegion", extra.focusRegion);
    const merged = { ...filters, ...(fixedRegion ? { region: fixedRegion } : {}) };
    Object.entries(merged).forEach(([a, b]) => b && p.set(a, b));
    return `/detail-monitoring?${p.toString()}`;
  };
  const goDetail = (viewKey: string, extra?: { focusRegion?: string }) => {
    router.push(detailUrl(viewKey, extra));
  };

  const kpis = isHO
    ? [
        { key: "totalSpbu", label: "Total SPBU", value: k.totalSpbu, icon: <Store className="h-6 w-6" />, tone: "navy" },
        { key: "spbuSubmitted", label: "SPBU sudah mengajukan", value: k.spbuSubmitted, icon: <Building2 className="h-6 w-6" />, tone: "blue", hint: "Jumlah SPBU unik, bukan jumlah transaksi" },
        { key: "total", label: "Total transaksi pengajuan", value: k.total, icon: <FileStack className="h-6 w-6" />, tone: "blue" },
        { key: "review", label: "Menunggu review", value: k.review, icon: <Clock className="h-6 w-6" />, tone: "amber", hint: "Berdasarkan status terakhir" },
        { key: "revision", label: "Perlu revisi", value: k.revision, icon: <FileEdit className="h-6 w-6" />, tone: "red" },
        { key: "approved", label: "Disetujui", value: k.approved, icon: <CheckCircle2 className="h-6 w-6" />, tone: "green", hint: "Disetujui, belum masuk pooling" },
        { key: "pooled", label: "Sudah masuk pooling", value: k.pooled, icon: <Layers className="h-6 w-6" />, tone: "blue", hint: "Sudah pooling, belum di-Memo" },
        { key: "memoed", label: "Sudah di-Memo", value: k.memoed, icon: <Send className="h-6 w-6" />, tone: "navy" },
      ]
    : [
        { key: "totalSpbu", label: data.scope === "SPBU" ? "Total SPBU" : "Total SPBU dalam Region", value: k.totalSpbu, icon: <Store className="h-6 w-6" />, tone: "navy" },
        { key: "spbuSubmitted", label: "SPBU sudah pernah mengajukan", value: k.spbuSubmitted, icon: <ClipboardCheck className="h-6 w-6" />, tone: "green", hint: "SPBU unik" },
        { key: "spbuNotSubmitted", label: "SPBU belum mengajukan", value: k.spbuNotSubmitted, icon: <Building2 className="h-6 w-6" />, tone: "slate" },
        { key: "total", label: "Total transaksi pengajuan", value: k.total, icon: <FileStack className="h-6 w-6" />, tone: "blue" },
        { key: "review", label: "Menunggu review", value: k.review, icon: <Clock className="h-6 w-6" />, tone: "amber" },
        { key: "revision", label: "Perlu revisi", value: k.revision, icon: <FileEdit className="h-6 w-6" />, tone: "red" },
        { key: "approved", label: "Disetujui", value: k.approved, icon: <CheckCircle2 className="h-6 w-6" />, tone: "green" },
        { key: "pooled", label: "Sudah masuk pooling", value: k.pooled, icon: <Layers className="h-6 w-6" />, tone: "blue" },
        { key: "memoed", label: "Sudah di-Memo", value: k.memoed, icon: <Send className="h-6 w-6" />, tone: "navy" },
      ];

  const statusViewKey: Record<string, string> = {
    [STATUS.UPLOADED]: "statusUploaded",
    [STATUS.REVIEW]: "statusReview",
    [STATUS.REVISION]: "revision",
    [STATUS.APPROVED]: "approved",
    [STATUS.POOLED]: "pooled",
    [STATUS.MEMOED]: "memoed",
  };

  const perRegion = data.byRegion.map((r) => ({ region_id: r.region_id, name: r.name.replace("Region ", "R"), full: r.name, Pengajuan: r.total }));
  const poolingFunnel = [
    { name: "Disetujui (kumulatif)", value: k.approvedOrBeyond, fill: "#69B345", view: "approvedCumulative" },
    { name: "Sudah pooling", value: k.pooledOrBeyond, fill: "#006CB7", view: "pooledCumulative" },
    { name: "Belum pooling", value: k.approved, fill: "#F59E0B", view: "approved" },
  ];
  const memoFunnel = [
    { name: "Sudah pooling (kumulatif)", value: k.pooledOrBeyond, fill: "#006CB7", view: "pooledCumulative" },
    { name: "Sudah di-Memo", value: k.memoed, fill: "#163B63", view: "memoed" },
    { name: "Pooling belum di-Memo", value: k.pooled, fill: "#F59E0B", view: "pooled" },
    { name: "MEMO diteruskan ke PAM", value: data.memoProgress.forwarded, fill: "#69B345", view: "memoForwarded" },
    { name: "MEMO belum diteruskan", value: data.memoProgress.notForwarded, fill: "#E52329", view: "memoNotForwarded" },
  ];
  const hasSubs = k.total > 0;
  const doneRegion = data.byRegion.map((r) => ({ region_id: r.region_id, name: r.name.replace("Region ", "R"), full: r.name, "Sudah selesai": r.spbuDone, "Belum selesai": Math.max(0, r.totalSpbu - r.spbuDone) }));

  return (
    <div className="space-y-5">
      {/* filter */}
      {data.scope !== "SPBU" && (
        <form className="card flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); apply(); }}>
          <Filter className="mb-2.5 h-4 w-4 text-slate-400" />
          <div><label className="label" htmlFor="fy">Tahun</label>
            <select id="fy" className="input w-28" value={f.year || ""} onChange={(e) => set("year", e.target.value)}><option value="">Semua</option>{data.years.map((y) => <option key={y}>{y}</option>)}</select></div>
          {role === "ADMIN_PAM" && !fixedRegion && (
            <div><label className="label" htmlFor="fr">Region</label>
              <select id="fr" className="input w-40" value={f.region || ""} onChange={(e) => set("region", e.target.value)}><option value="">Semua Region</option>{data.regions.map((r) => <option key={r.region_id} value={r.region_id}>{r.region_name}</option>)}</select></div>
          )}
          <div><label className="label" htmlFor="fs">SPBU</label>
            <select id="fs" className="input w-56" value={f.spbu || ""} onChange={(e) => set("spbu", e.target.value)}><option value="">Semua SPBU</option>{data.spbuOptions.map((s) => <option key={s.id} value={s.id}>{s.name.replace("SPBU-", "")}</option>)}</select></div>
          <div><label className="label" htmlFor="fsid">ID Pengajuan</label><input id="fsid" className="input w-36 font-mono" placeholder="SUB-0001…" value={f.subId || ""} onChange={(e) => set("subId", e.target.value)} /></div>
          <div><label className="label" htmlFor="fst">Status</label>
            <select id="fst" className="input w-52" value={f.status || ""} onChange={(e) => set("status", e.target.value)}><option value="">Semua status</option>{STATUS_LIST.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label" htmlFor="ff">Nomor FUPA</label><input id="ff" className="input w-40" placeholder="cari…" value={f.fupa || ""} onChange={(e) => set("fupa", e.target.value)} /></div>
          <div><label className="label" htmlFor="fm">Nomor MEMO</label><input id="fm" className="input w-40" placeholder="cari…" value={f.memo || ""} onChange={(e) => set("memo", e.target.value)} /></div>
          <div className="flex gap-2"><button className="btn-primary">Terapkan</button>{active && <button type="button" className="btn-ghost" onClick={reset}><X className="h-4 w-4" />Reset</button>}</div>
        </form>
      )}

      {data.scope === "SPBU" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-slate-600">Dashboard ini hanya menampilkan data SPBU Anda.</p>
          <Link href="/submissions/new" className="btn-primary"><Plus className="h-4 w-4" />Buat Pengajuan Usul Musnah</Link>
        </div>
      )}

      <div className={`grid gap-3 sm:grid-cols-2 ${isHO ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {kpis.map((c) => (
          <KpiCard
            key={c.label}
            label={c.label}
            value={c.value}
            icon={c.icon}
            tone={c.tone as any}
            hint={(c as any).hint}
            href={detailUrl(c.key)}
          />
        ))}
      </div>
      <p className="-mt-2 text-[11px] text-slate-500">
        Jumlah per status dihitung dari status terakhir tiap transaksi pengajuan. SPBU dihitung unik (satu SPBU dengan banyak pengajuan tetap dihitung satu). Klik salah satu poin KPI atau bagian grafik mana saja untuk berpindah ke halaman <Link href={detailUrl(data.scope === "SPBU" ? "total" : "totalSpbu")} className="font-semibold text-brand hover:underline">Rincian Data Monitoring</Link>.
      </p>

      {/* grafik */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {isHO && (
          <ChartCard title="Jumlah pengajuan per Region" empty={!hasSubs}
            action={<Link href={detailUrl("total")} className="shrink-0 text-[11px] font-semibold text-brand hover:underline">Semua ({k.total}) →</Link>}>
            <ResponsiveContainer>
              <BarChart data={perRegion} onClick={(st: any) => { const d = st?.activePayload?.[0]?.payload; if (d?.region_id) goDetail("total", { focusRegion: d.region_id }); }}>
                <CartesianGrid vertical={false} stroke="#E5EAF1" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                <Bar dataKey="Pengajuan" fill="#006CB7" radius={[6, 6, 0, 0]} onClick={(d: any, _: number, e: any) => { e?.stopPropagation?.(); const p = d?.payload ?? d; if (p?.region_id) goDetail("total", { focusRegion: p.region_id }); }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
        <ChartCard title="Perbandingan status pengajuan" empty={!hasSubs}>
          <Donut
            data={data.statusCounts.filter((s) => s.count > 0).map((s) => ({ name: s.status, value: s.count, color: COLORS[s.status] }))}
            onSelect={(st) => goDetail(statusViewKey[st] || "total")}
          />
        </ChartCard>
        <ChartCard title="Progres pooling FUPA" note="Dari pengajuan yang disetujui, berapa yang sudah di-pooling" empty={!hasSubs}>
          <ResponsiveContainer>
            <BarChart data={poolingFunnel} layout="vertical" margin={{ left: 20 }} onClick={(st: any) => { const d = st?.activePayload?.[0]?.payload; if (d?.view) goDetail(d.view); }}>
              <CartesianGrid horizontal={false} stroke="#E5EAF1" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} /><Tooltip />
              <Bar dataKey="value" name="Pengajuan" radius={[0, 6, 6, 0]} onClick={(d: any, _: number, e: any) => { e?.stopPropagation?.(); const p = d?.payload ?? d; if (p?.view) goDetail(p.view); }}>
                {poolingFunnel.map((d) => <Cell key={d.name} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Progres penerbitan MEMO" note="Termasuk status penerusan MEMO ke PAM" empty={!hasSubs}>
          <ResponsiveContainer>
            <BarChart data={memoFunnel} layout="vertical" margin={{ left: 20 }} onClick={(st: any) => { const d = st?.activePayload?.[0]?.payload; if (d?.view) goDetail(d.view); }}>
              <CartesianGrid horizontal={false} stroke="#E5EAF1" /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10 }} /><Tooltip />
              <Bar dataKey="value" name="Jumlah" radius={[0, 6, 6, 0]} onClick={(d: any, _: number, e: any) => { e?.stopPropagation?.(); const p = d?.payload ?? d; if (p?.view) goDetail(p.view); }}>
                {memoFunnel.map((d) => <Cell key={d.name} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        {data.scope !== "SPBU" && (
          <ChartCard title="SPBU sudah vs belum mengajukan" note="Jumlah SPBU unik" empty={k.spbuSubmitted + k.spbuNotSubmitted === 0}>
            <Donut
              data={[{ name: "Sudah mengajukan", value: k.spbuSubmitted, color: "#69B345" }, { name: "Belum mengajukan", value: k.spbuNotSubmitted, color: "#CBD5E1" }]}
              onSelect={(n) => goDetail(n === "Sudah mengajukan" ? "spbuSubmitted" : "spbuNotSubmitted")}
            />
          </ChartCard>
        )}
        {data.scope !== "SPBU" && (
          <ChartCard title="SPBU yang sudah selesai musnah" note="SPBU unik dengan pengajuan berstatus akhir “Sudah Di-Memo”" empty={k.totalSpbu === 0}
            action={<Link href={detailUrl("spbuDone")} className="shrink-0 text-[11px] font-semibold text-brand hover:underline">Selesai ({k.spbuDone}) →</Link>}>
            {isHO ? (
              <ResponsiveContainer>
                <BarChart data={doneRegion}>
                  <CartesianGrid vertical={false} stroke="#E5EAF1" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }}
                    onClick={(l: any) => goDetail(l?.value === "Sudah selesai" ? "spbuDone" : "spbuNotDone")} />
                  <Bar dataKey="Sudah selesai" stackId="d" fill="#163B63"
                    onClick={(d: any, _: number, e: any) => { e?.stopPropagation?.(); const p = d?.payload ?? d; if (p?.region_id) goDetail("spbuDone", { focusRegion: p.region_id }); }} />
                  <Bar dataKey="Belum selesai" stackId="d" fill="#CBD5E1" radius={[6, 6, 0, 0]}
                    onClick={(d: any, _: number, e: any) => { e?.stopPropagation?.(); const p = d?.payload ?? d; if (p?.region_id) goDetail("spbuNotDone", { focusRegion: p.region_id }); }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Donut
                data={[{ name: "Sudah selesai musnah", value: k.spbuDone, color: "#163B63" }, { name: "Belum selesai", value: Math.max(0, k.totalSpbu - k.spbuDone), color: "#CBD5E1" }]}
                onSelect={(n) => goDetail(n === "Sudah selesai musnah" ? "spbuDone" : "spbuNotDone")}
              />
            )}
          </ChartCard>
        )}
      </div>

      {/* tabel */}
      {isHO ? (
        <section>
          <h2 className="mb-2 text-sm font-bold text-navy">Monitoring per Region <span className="font-normal text-slate-500">— klik nama Region untuk detail</span></h2>
          <DataTable
            rows={data.byRegion} rowKey={(r) => r.region_id} exportName="monitoring-region" pageSize={10} searchPlaceholder="Cari Region…"
            rowHref={(r) => `/dashboard/region/${r.region_id}`}
            columns={[
              { key: "name", header: "Nama Region" },
              { key: "totalSpbu", header: "Total SPBU", align: "right" },
              { key: "spbuSubmitted", header: "SPBU Sudah Mengajukan", align: "right" },
              { key: "total", header: "Total Transaksi", align: "right" },
              { key: "review", header: "Menunggu Review", align: "right" },
              { key: "revision", header: "Perlu Revisi", align: "right" },
              { key: "approved", header: "Disetujui", align: "right" },
              { key: "pooled", header: "Sudah Pooling", align: "right" },
              { key: "memoed", header: "Sudah di-Memo", align: "right" },
            ]}
          />
        </section>
      ) : data.scope === "REGION" ? (
        <section>
          <h2 className="mb-2 text-sm font-bold text-navy">Monitoring SPBU <span className="font-normal text-slate-500">— seluruh SPBU dalam Region, klik nama SPBU untuk semua transaksinya</span></h2>
          <DataTable
            rows={data.spbuRows} rowKey={(r) => r.spbu_id} exportName="monitoring-spbu" pageSize={15} searchPlaceholder="Cari SPBU, kode, ID Pengajuan, nomor FUPA/MEMO…"
            rowHref={(r) => `/dashboard/spbu/${r.spbu_id}`}
            filters={[{ label: "Status terakhir", get: (r) => r.lastStatus, options: [...STATUS_LIST, "Belum mengajukan"] }, ...(role === "ADMIN_PAM" ? [] : [])]}
            columns={[
              { key: "name", header: "SPBU", render: (r) => <span>{r.name}<span className="block text-[11px] font-normal text-slate-400">{r.spbu_code}</span></span>, value: (r) => r.name },
              {
                key: "submissionIdsText",
                header: "ID Pengajuan",
                render: (r) => r.submissionIds.length ? (
                  <div className="flex flex-wrap gap-1">
                    {r.submissionIds.map((sid) => (
                      <Link key={sid} href={`/submissions/${sid}`} className="rounded bg-softblue px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand hover:bg-brand hover:text-white">
                        {sid}
                      </Link>
                    ))}
                  </div>
                ) : "-",
                value: (r) => r.firstSubmissionId || "ZZZ",
              },
              { key: "total", header: "Total Pengajuan", align: "right" },
              { key: "lastStatus", header: "Status Terakhir", render: (r) => r.total ? <StatusBadge status={r.lastStatus} /> : <span className="text-xs text-slate-400">Belum mengajukan</span> },
              { key: "fupa", header: "Nomor FUPA" },
              { key: "memo", header: "Nomor MEMO" },
            ]}
          />
        </section>
      ) : null}

      {data.scope === "SPBU" && (
        <p className="text-sm text-slate-500">Rincian setiap pengajuan tersedia di menu <Link href="/submissions" className="font-semibold text-brand hover:underline">Pengajuan Usul Musnah Arsip</Link>.</p>
      )}
      {(role === "ADMIN_REGION" || role === "ADMIN_PAM") && !isHO && null}
      <span hidden>{basePath}</span>
    </div>
  );
}
