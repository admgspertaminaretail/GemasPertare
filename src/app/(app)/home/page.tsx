import Link from "next/link";
import { LayoutDashboard, ClipboardList, BookOpen, FileDown, FilePlus2, Bot, ArrowRight, AlertTriangle, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboard } from "@/lib/services/monitoring";
import { SpbuScene } from "@/components/art/SpbuScene";
import { Mascot } from "@/components/art/Mascot";
import { DemoTag } from "@/components/ui/kit";
import { ROLE_LABEL, STATUS, STATUS_STYLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MENUS = [
  { href: "/dashboard", title: "Dashboard Monitoring", desc: "Pantau progres pengajuan, pooling FUPA, dan MEMO.", icon: LayoutDashboard, tone: "bg-brand" },
  { href: "/detail-monitoring", title: "Rincian Data Monitoring", desc: "Lihat tabel lengkap rincian tiap poin KPI dan grafik.", icon: ClipboardList, tone: "bg-navy" },
  { href: "/info", title: "Pusat Informasi Arsip", desc: "Pedoman, TKI, JRDP, buku saku, dan manual i-BOS.", icon: BookOpen, tone: "bg-brand-700" },
  { href: "/templates", title: "Pusat Template", desc: "Unduh template i-BOS, Form FUPA, dan Daftar Arsip.", icon: FileDown, tone: "bg-prtgreen" },
  { href: "/submissions", title: "Pengajuan Usul Musnah Arsip", desc: "Ajukan, review, pooling, dan catat MEMO.", icon: FilePlus2, tone: "bg-prtred" },
  { href: "/ask", title: "Tanya si GEMAS", desc: "Asisten AI berbasis dokumen resmi perusahaan.", icon: Bot, tone: "bg-gradient-to-br from-brand to-prtgreen" },
];

export default async function HomePage() {
  const u = await requireUser();
  const d = await getDashboard(u);
  const k = d.kpi;
  const summary = [
    { label: "Menunggu review", v: k.review, s: STATUS.REVIEW, view: "review" },
    { label: "Perlu revisi", v: k.revision, s: STATUS.REVISION, view: "revision" },
    { label: "Disetujui", v: k.approved, s: STATUS.APPROVED, view: "approved" },
    { label: "Sudah pooling", v: k.pooled, s: STATUS.POOLED, view: "pooled" },
    { label: "Sudah di-Memo", v: k.memoed, s: STATUS.MEMOED, view: "memoed" },
  ];
  const alert =
    u.role === "ADMIN_SPBU" && k.revision > 0 ? { text: `${k.revision} pengajuan Anda perlu revisi.`, href: "/submissions", icon: AlertTriangle, cls: "bg-red-50 text-prtred ring-red-100" }
    : u.role === "ADMIN_REGION" && k.review > 0 ? { text: `${k.review} pengajuan menunggu review Anda.`, href: "/submissions", icon: Clock, cls: "bg-amber-50 text-amber-800 ring-amber-100" }
    : u.role === "ADMIN_REGION" && k.approved > 0 ? { text: `${k.approved} pengajuan disetujui dan siap di-pooling.`, href: "/submissions?tab=pooling", icon: Clock, cls: "bg-blue-50 text-brand ring-blue-100" }
    : null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-600 to-navy p-6 text-white shadow-pop sm:p-10">
        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="chip bg-white/15 text-white ring-white/25">{ROLE_LABEL[u.role]}</span>
              {u.isDemo && process.env.DEMO_MODE !== "false" && <DemoTag />}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">Halo, Sahabat Arsip!</h1>
            <p className="mt-3 max-w-lg text-base text-white/85">Selamat datang di GEMAS. Pusat informasi dan monitoring pengelolaan arsip PT Pertamina Retail.</p>
            <p className="mt-1 text-sm text-white/70">{u.name}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {u.role === "ADMIN_SPBU" && <Link href="/submissions/new" className="btn bg-prtred text-white hover:bg-red-700">+ Buat Pengajuan Usul Musnah</Link>}
              <Link href="/ask" className="btn bg-white text-brand hover:bg-softblue"><Bot className="h-4 w-4" />Tanya si GEMAS</Link>
            </div>
          </div>
          <div className="relative"><SpbuScene className="mx-auto w-full max-w-[560px] drop-shadow-2xl" /></div>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
      </section>

      {alert && (
        <Link href={alert.href} className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold ring-1 ${alert.cls}`}>
          <alert.icon className="h-5 w-5" />{alert.text}<ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Ringkasan status pengajuan {u.role === "ADMIN_SPBU" ? "SPBU Anda" : u.role === "ADMIN_REGION" ? "Region Anda" : "seluruh Region"}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link href="/detail-monitoring?view=total" className="card p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
            <div className="text-2xl font-extrabold text-navy">{k.total}</div>
            <div className="text-xs text-slate-500">Total pengajuan</div>
          </Link>
          {summary.map((s) => (
            <Link key={s.label} href={`/detail-monitoring?view=${s.view}`} className="card p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="text-2xl font-extrabold text-navy">{s.v}</div>
              <span className={`chip mt-1 ${STATUS_STYLE[s.s]}`}>{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Menu utama</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MENUS.map((m) => (
            <Link key={m.href} href={m.href} className="card group relative flex gap-4 overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-card ${m.tone}`}><m.icon className="h-7 w-7" /></div>
              <div className="min-w-0">
                <h3 className="font-bold text-navy">{m.title}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{m.desc}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand">Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
              </div>
              {m.href === "/ask" && <Mascot size={70} className="absolute -bottom-2 right-1 opacity-90" />}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
