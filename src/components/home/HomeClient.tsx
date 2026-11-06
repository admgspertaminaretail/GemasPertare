"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crown,
  FileStack,
  Flame,
  Image as ImageIcon,
  Loader2,
  Medal,
  Pencil,
  Plus,
  Power,
  Settings2,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { HomeSlideItem, RegionRankItem, SpbuRankItem } from "@/lib/services/home";
import { SpbuScene } from "../art/SpbuScene";
import { Mascot } from "../art/Mascot";
import { DemoTag } from "../ui/kit";
import { ConfirmModal, Modal } from "../ui/Modal";
import { FileField } from "../ui/FileField";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { ROLE_LABEL, RoleId, STATUS } from "@/lib/constants";

interface SlideForm {
  title: string;
  badge: string;
  description: string;
  cta_label: string;
  cta_href: string;
  sort_order: string;
}

const BLANK_SLIDE: SlideForm = {
  title: "",
  badge: "Info Kearsipan",
  description: "",
  cta_label: "Buka Pusat Informasi",
  cta_href: "/info",
  sort_order: "1",
};

function DefaultSlideArt({ index }: { index: number }) {
  if (index % 3 === 0) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-sky-500/30 via-brand/40 to-navy p-4">
        <SpbuScene className="w-full max-w-[420px] drop-shadow-2xl" />
      </div>
    );
  }
  if (index % 3 === 1) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-500/30 via-teal-600/30 to-navy p-6 text-center text-white">
        <div className="rounded-3xl bg-white/15 p-4 backdrop-blur">
          <Mascot size={115} className="animate-floaty" />
        </div>
        <div className="mt-3 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
          Jadwal Retensi Dokumen Perusahaan (JRDP)
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-amber-400/30 via-prtred/30 to-navy p-6 text-center text-white">
      <div className="flex items-center gap-3 rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
        <Mascot size={95} mood="happy" />
        <div className="text-left">
          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-200">Prosedur Resmi</div>
          <div className="text-base font-extrabold">Pilah → Daftar Arsip → Review → MEMO</div>
        </div>
      </div>
    </div>
  );
}

export function HomeClient({
  role,
  userDisplayName,
  greetingName,
  isDemo,
  slides,
  kpi,
  scope,
  regionStats,
  nationalTotalSubmissions,
  topRegions,
  topSpbus,
  mySpbuRank,
  myRegionRank,
}: {
  role: RoleId;
  userDisplayName: string;
  greetingName: string;
  isDemo: boolean;
  slides: HomeSlideItem[];
  kpi: any;
  scope: string;
  regionStats: RegionRankItem[];
  nationalTotalSubmissions: number;
  topRegions: RegionRankItem[];
  topSpbus: SpbuRankItem[];
  mySpbuRank: number | null;
  myRegionRank: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const canManageSlides = role === "ADMIN_PAM";

  const activeSlides = slides.filter((s) => s.status === "Aktif");
  const displaySlides = activeSlides.length > 0 ? activeSlides : slides;

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [leaderTab, setLeaderTab] = useState<"region" | "spbu">("region");

  // Modal kelola slide (khusus Admin GS / PAM)
  const [manageOpen, setManageOpen] = useState(false);
  const [editSlide, setEditSlide] = useState<{ id?: string; form: SlideForm } | null>(null);
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [delSlide, setDelSlide] = useState<HomeSlideItem | null>(null);
  const [busySlide, setBusySlide] = useState(false);

  useEffect(() => {
    if (idx >= displaySlides.length) setIdx(0);
  }, [displaySlides.length, idx]);

  useEffect(() => {
    if (paused || displaySlides.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % displaySlides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [paused, displaySlides.length]);

  const currentSlide = displaySlides[idx] || null;

  const compressSlidePhoto = (f: File): Promise<File> =>
    new Promise((resolve) => {
      if (f.size <= 30000) return resolve(f);
      const img = new window.Image();
      const objUrl = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        const maxW = 900;
        const scale = Math.min(1, maxW / (img.width || maxW));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(f);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= f.size) return resolve(f);
            const cleanName = f.name.replace(/\.[^.]+$/, "") + ".jpg";
            resolve(new File([blob], cleanName, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.72
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(f);
      };
      img.src = objUrl;
    });

  const saveSlide = async () => {
    if (!editSlide) return;
    setBusySlide(true);
    try {
      const fd = new FormData();
      fd.set("action", editSlide.id ? "update" : "create");
      if (editSlide.id) fd.set("id", editSlide.id);
      Object.entries(editSlide.form).forEach(([k, v]) => fd.set(k, v));
      if (slideFiles[0]) fd.set("image", await compressSlidePhoto(slideFiles[0]));
      await api("/api/home-slides", fd);
      toast("success", editSlide.id ? "Slide Beranda diperbarui." : "Slide baru berhasil ditambahkan.");
      setEditSlide(null);
      setSlideFiles([]);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusySlide(false);
    }
  };

  const toggleSlideStatus = async (s: HomeSlideItem) => {
    setBusySlide(true);
    try {
      const fd = new FormData();
      fd.set("action", "toggle");
      fd.set("id", s.slide_id);
      fd.set("active", s.status === "Aktif" ? "0" : "1");
      await api("/api/home-slides", fd);
      toast("success", s.status === "Aktif" ? "Slide dinonaktifkan." : "Slide diaktifkan.");
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusySlide(false);
    }
  };

  const confirmDeleteSlide = async () => {
    if (!delSlide) return;
    setBusySlide(true);
    try {
      const fd = new FormData();
      fd.set("action", "delete");
      fd.set("id", delSlide.slide_id);
      await api("/api/home-slides", fd);
      toast("success", "Slide dihapus.");
      setDelSlide(null);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusySlide(false);
    }
  };

  const alert =
    role === "ADMIN_SPBU" && kpi.revision > 0
      ? { text: `${kpi.revision} pengajuan SPBU Anda perlu revisi.`, href: "/submissions", icon: AlertTriangle, cls: "bg-red-50 text-prtred ring-red-200" }
      : role === "ADMIN_REGION" && kpi.review > 0
        ? { text: `${kpi.review} pengajuan menunggu review Anda.`, href: "/submissions", icon: Clock, cls: "bg-amber-50 text-amber-800 ring-amber-200" }
        : role === "ADMIN_REGION" && kpi.approved > 0
          ? { text: `${kpi.approved} pengajuan disetujui dan siap masuk Pooling FUPA.`, href: "/submissions?tab=pooling", icon: Clock, cls: "bg-blue-50 text-brand ring-blue-200" }
          : null;

  // Data Progress Pengajuan (pengganti Dashboard Monitoring)
  const totalScoped = kpi.total || 0;
  const stages = [
    { label: "Menunggu Review", count: kpi.review || 0, color: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50", view: "review", status: STATUS.REVIEW },
    { label: "Perlu Revisi", count: kpi.revision || 0, color: "bg-prtred", text: "text-prtred", bg: "bg-red-50", view: "revision", status: STATUS.REVISION },
    { label: "Disetujui Region", count: kpi.approved || 0, color: "bg-prtgreen", text: "text-emerald-700", bg: "bg-emerald-50", view: "approved", status: STATUS.APPROVED },
    { label: "Sudah Pooling", count: kpi.pooled || 0, color: "bg-brand", text: "text-brand", bg: "bg-softblue", view: "pooled", status: STATUS.POOLED },
    { label: "Sudah Di-Memo", count: kpi.memoed || 0, color: "bg-navy", text: "text-navy", bg: "bg-slate-100", view: "memoed", status: STATUS.MEMOED },
  ];
  const progressedPct = totalScoped > 0 ? Math.round(((kpi.approvedOrBeyond || 0) / totalScoped) * 100) : 0;

  const regionChartData = regionStats.map((r) => ({
    ...r,
    name: r.short_name,
    "Total Pengajuan": r.total_submissions,
    "Selesai (Di-Memo)": r.memoed,
  }));

  const REGION_COLORS = ["#006CB7", "#0EA5E9", "#10B981", "#69B345", "#F59E0B", "#6366F1", "#EC4899"];

  return (
    <div className="space-y-6">
      {/* 1. HEADER SAPAAN PERSONAL + SLIDER FOTO & INFORMASI ARSIP */}
      <section
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-brand-700 to-brand text-white shadow-pop"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Top bar sapaan */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-6 py-4 sm:px-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-white/15 text-white ring-white/25">{ROLE_LABEL[role]}</span>
              {isDemo && <DemoTag />}
              {!greetingName && (
                <span className="text-[11px] text-amber-200">
                  ✨ Isi nama Anda di Profil kanan atas agar sapaan tampil atas nama Anda
                </span>
              )}
            </div>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-4xl">
              Halo, {greetingName ? greetingName : "Sahabat Arsip"}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-white/80">
              Selamat datang di GEMAS — Pusat Informasi &amp; Monitoring Pengelolaan Arsip PT Pertamina Retail ({userDisplayName}).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {role === "ADMIN_SPBU" && (
              <Link href="/submissions/new" className="btn bg-prtred text-white shadow-card hover:bg-red-700">
                <Plus className="h-4 w-4" />
                Buat Pengajuan Usul Musnah
              </Link>
            )}
            {canManageSlides && (
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="btn bg-white/15 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/25"
              >
                <Settings2 className="h-4 w-4" />
                Kelola Foto &amp; Info Slide
              </button>
            )}
          </div>
        </div>

        {/* Area Carousel Foto & Informasi Arsip */}
        {currentSlide && (
          <div className="grid min-h-[290px] items-stretch lg:grid-cols-[1.1fr_1fr]">
            {/* Teks Informasi Arsip */}
            <div className="flex flex-col justify-between p-6 sm:p-8">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/40">
                  <Sparkles className="h-3.5 w-3.5" />
                  {currentSlide.badge || "Informasi Arsip"}
                </span>
                <h2 className="mt-3 text-xl font-extrabold leading-snug sm:text-3xl">
                  {currentSlide.title}
                </h2>
                <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
                  {currentSlide.description}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex flex-wrap items-center gap-3">
                  {currentSlide.cta_label && currentSlide.cta_href && (
                    <Link
                      href={currentSlide.cta_href}
                      className="btn bg-white text-navy shadow-card hover:bg-softblue"
                    >
                      {currentSlide.cta_label}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>

                {/* Navigasi Slide */}
                {displaySlides.length > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Slide sebelumnya"
                      onClick={() => setIdx((idx - 1 + displaySlides.length) % displaySlides.length)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-1.5 px-1">
                      {displaySlides.map((s, i) => (
                        <button
                          key={s.slide_id}
                          type="button"
                          aria-label={`Pilih slide ${i + 1}`}
                          onClick={() => setIdx(i)}
                          className={`h-2.5 rounded-full transition-all ${
                            i === idx ? "w-7 bg-amber-300" : "w-2.5 bg-white/40 hover:bg-white/70"
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      aria-label="Slide berikutnya"
                      onClick={() => setIdx((idx + 1) % displaySlides.length)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 transition hover:bg-white/30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Foto Slide / Visual */}
            <div className="relative min-h-[230px] overflow-hidden border-t border-white/10 lg:border-l lg:border-t-0">
              {currentSlide.has_image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentSlide.image_url}
                  alt={currentSlide.title}
                  className="h-full max-h-[360px] w-full object-cover"
                />
              ) : (
                <DefaultSlideArt index={idx} />
              )}
            </div>
          </div>
        )}
      </section>

      {alert && (
        <Link href={alert.href} className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold ring-1 ${alert.cls}`}>
          <alert.icon className="h-5 w-5 shrink-0" />
          <span>{alert.text}</span>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
        </Link>
      )}

      {/* 2. PROGRESS PENGAJUAN & HIGHLIGHT TOTAL PENGAJUAN (Menggantikan Dashboard Monitoring) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-navy sm:text-lg">
              Progres Pengajuan Usul Musnah {scope === "SPBU" ? "SPBU Anda" : scope === "REGION" ? "Region Anda" : "Nasional"}
            </h2>
            <p className="text-xs text-slate-500">
              Klik kartu atau tahapan progres untuk melihat tabel lengkap di Rincian Data Monitoring.
            </p>
          </div>
          <Link href="/detail-monitoring?view=total" className="text-xs font-bold text-brand hover:underline">
            Buka Rincian Data Monitoring →
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-[310px_1fr]">
          {/* HIGHLIGHT KARTU TOTAL PENGAJUAN */}
          <Link
            href="/detail-monitoring?view=total"
            className="group relative flex flex-col justify-between overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-600 to-navy p-6 text-white shadow-pop ring-4 ring-blue-100 transition hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-navy">
                  <Sparkles className="h-3 w-3" />
                  Highlight Utama
                </span>
                <div className="mt-2 text-sm font-semibold text-white/85">Total Pengajuan Arsip</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <FileStack className="h-6 w-6 text-amber-300" />
              </div>
            </div>

            <div className="my-3">
              <div className="text-5xl font-black tracking-tight text-white">{totalScoped}</div>
              <div className="mt-1 text-xs text-white/80">
                {scope === "SPBU"
                  ? "Transaksi pengajuan dari SPBU Anda"
                  : `${kpi.spbuSubmitted || 0} dari ${kpi.totalSpbu || 0} SPBU telah mengajukan`}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/15 pt-3 text-xs font-bold text-amber-200">
              <span>Lihat seluruh rincian</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
          </Link>

          {/* KARTU PROGRESS BAR & TAHAPAN */}
          <div className="card flex flex-col justify-between p-5 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold text-navy">Alur Progres Penyelesaian Pengajuan</div>
                  <div className="text-xs text-slate-500">
                    <b>{kpi.approvedOrBeyond || 0}</b> pengajuan ({progressedPct}%) telah disetujui / masuk tahap Pooling &amp; MEMO
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200">
                  {progressedPct}% Terverifikasi
                </span>
              </div>

              {/* Multi-segment progress bar */}
              <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200/70">
                {totalScoped === 0 ? (
                  <div className="h-full w-full rounded-full bg-slate-200" />
                ) : (
                  stages.map((st) =>
                    st.count > 0 ? (
                      <div
                        key={st.label}
                        title={`${st.label}: ${st.count} pengajuan`}
                        style={{ width: `${Math.max(4, (st.count / totalScoped) * 100)}%` }}
                        className={`h-full first:rounded-l-full last:rounded-r-full ${st.color} transition-all`}
                      />
                    ) : null
                  )
                )}
              </div>
            </div>

            {/* Rincian tiap tahap */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {stages.map((st) => {
                const pct = totalScoped > 0 ? Math.round((st.count / totalScoped) * 100) : 0;
                return (
                  <Link
                    key={st.label}
                    href={`/detail-monitoring?view=${st.view}`}
                    className={`group rounded-2xl p-3 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-card ${st.bg}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`h-2.5 w-2.5 rounded-full ${st.color}`} />
                      <span className="text-[11px] font-bold text-slate-400">{pct}%</span>
                    </div>
                    <div className={`mt-1.5 text-2xl font-extrabold ${st.text}`}>{st.count}</div>
                    <div className="mt-0.5 text-xs font-semibold text-navy group-hover:underline">{st.label}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 3. DRAG KE BAWAH: CHARTS TOTAL PENGAJUAN 7 REGION & PERINGKAT TOP 3 SERU */}
      <section className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        {/* GRAFIK 7 REGION */}
        <div className="card flex flex-col justify-between p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-softblue px-2.5 py-0.5 text-[11px] font-extrabold text-brand">
                <TrendingUp className="h-3.5 w-3.5" />
                Statistik Nasional Terintegrasi
              </div>
              <h2 className="mt-1.5 text-lg font-extrabold text-navy">
                Grafik Total Pengajuan dari {regionStats.length} Region
              </h2>
              <p className="text-xs text-slate-500">
                Total <b>{nationalTotalSubmissions}</b> pengajuan usul musnah arsip terintegrasi dari seluruh Region PT Pertamina Retail.
              </p>
            </div>
          </div>

          <div className="mt-4 h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionChartData} margin={{ top: 10, right: 12, left: -10, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke="#E5EAF1" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: "#163B63" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as RegionRankItem;
                    return (
                      <div className="rounded-2xl bg-navy p-3.5 text-xs text-white shadow-pop">
                        <div className="font-extrabold text-amber-300">
                          {r.region_name} {r.is_my_region ? "· (Region Anda)" : ""}
                        </div>
                        {r.pic_name && (
                          <div className="mt-0.5 text-[11px] text-sky-200">PIC Region: {r.pic_name}</div>
                        )}
                        <div className="mt-2 space-y-1 border-t border-white/15 pt-2">
                          <div>Total Pengajuan: <b>{r.total_submissions}</b></div>
                          <div>Selesai Di-Memo: <b>{r.memoed}</b></div>
                          <div>SPBU Mengajukan: <b>{r.spbu_submitted}</b> / {r.total_spbu} SPBU ({r.participation_pct}%)</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Total Pengajuan" radius={[8, 8, 0, 0]}>
                  {regionChartData.map((entry, index) => (
                    <Cell
                      key={entry.region_id}
                      fill={entry.is_my_region ? "#E52329" : REGION_COLORS[index % REGION_COLORS.length]}
                    />
                  ))}
                </Bar>
                <Bar dataKey="Selesai (Di-Memo)" fill="#163B63" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-cloud px-4 py-2.5 text-xs text-slate-600">
            <span>
              {role !== "ADMIN_PAM"
                ? "Bar berwarna merah menandai capaian Region Anda saat ini."
                : "Data grafik diperbarui otomatis setiap kali SPBU mengirim pengajuan."}
            </span>
            <span className="font-bold text-navy">{regionStats.length} Region Aktif</span>
          </div>
        </div>

        {/* PERINGKAT TOP 3 SERU — PEMACU SEMANGAT SPBU */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-5 shadow-card ring-1 ring-amber-200/80 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/25 px-3 py-0.5 text-[11px] font-extrabold text-amber-900 ring-1 ring-amber-400/40">
                <Flame className="h-3.5 w-3.5 text-prtred" />
                Hall of Fame · Tertib Arsip!
              </div>
              <h2 className="mt-1.5 flex items-center gap-2 text-lg font-extrabold text-navy">
                <Trophy className="h-5 w-5 text-amber-500" />
                Peringkat Top 3 Teraktif
              </h2>
              <p className="text-xs text-slate-600">
                Apresiasi bagi Region &amp; SPBU paling sigap mengelola usul musnah arsip!
              </p>
            </div>

            <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setLeaderTab("region")}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  leaderTab === "region" ? "bg-brand text-white" : "text-navy hover:bg-softblue"
                }`}
              >
                🏆 Top 3 Region
              </button>
              <button
                type="button"
                onClick={() => setLeaderTab("spbu")}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                  leaderTab === "spbu" ? "bg-prtgreen text-white" : "text-navy hover:bg-emerald-50"
                }`}
              >
                ⭐ Top 3 SPBU
              </button>
            </div>
          </div>

          {/* Kartu Podium Top 3 */}
          <div className="mt-4 space-y-3">
            {leaderTab === "region" ? (
              topRegions.map((r, i) => {
                const rankStyle =
                  i === 0
                    ? {
                        card: "bg-gradient-to-r from-amber-400/25 via-yellow-50 to-white ring-2 ring-amber-400 shadow-md",
                        badgeBg: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
                        titleTag: "JUARA 1 · GOLD CHAMPION",
                        icon: <Crown className="h-5 w-5" />,
                      }
                    : i === 1
                      ? {
                          card: "bg-gradient-to-r from-slate-200/70 via-white to-white ring-1 ring-slate-300",
                          badgeBg: "bg-gradient-to-br from-slate-400 to-slate-600 text-white",
                          titleTag: "PERINGKAT 2 · SILVER STAR",
                          icon: <Medal className="h-5 w-5" />,
                        }
                      : {
                          card: "bg-gradient-to-r from-orange-200/60 via-white to-white ring-1 ring-orange-300",
                          badgeBg: "bg-gradient-to-br from-amber-600 to-amber-800 text-white",
                          titleTag: "PERINGKAT 3 · BRONZE HERO",
                          icon: <Award className="h-5 w-5" />,
                        };
                return (
                  <div key={r.region_id} className={`rounded-2xl p-4 transition hover:-translate-y-0.5 ${rankStyle.card}`}>
                    <div className="flex items-center gap-3.5">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black shadow-sm ${rankStyle.badgeBg}`}>
                        {rankStyle.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                            {rankStyle.titleTag}
                          </span>
                          {r.is_my_region && (
                            <span className="rounded-full bg-prtred px-2 py-0.5 text-[10px] font-extrabold text-white">
                              Region Kita! 🔥
                            </span>
                          )}
                        </div>
                        <div className="truncate text-base font-extrabold text-navy">
                          {r.region_name}
                          {r.pic_name && (
                            <span className="ml-1.5 text-xs font-semibold text-brand">· {r.pic_name}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-600">
                          <b>{r.spbu_submitted}</b> dari {r.total_spbu} SPBU aktif mengajukan ({r.participation_pct}% partisipasi)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-navy">{r.total_submissions}</div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Pengajuan</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : topSpbus.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
                Belum ada pengajuan SPBU. Jadilah SPBU pertama yang naik ke Podium Juara 1! 🚀
              </div>
            ) : (
              topSpbus.map((s, i) => {
                const medal = i === 0 ? "🥇 Juara 1" : i === 1 ? "🥈 Juara 2" : "🥉 Juara 3";
                const bg =
                  i === 0
                    ? "bg-gradient-to-r from-amber-400/25 via-yellow-50 to-white ring-2 ring-amber-400 shadow-md"
                    : i === 1
                      ? "bg-white ring-1 ring-slate-300"
                      : "bg-white ring-1 ring-orange-300";
                return (
                  <div key={s.spbu_id} className={`rounded-2xl p-4 transition hover:-translate-y-0.5 ${bg}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                            {medal} · Pejuang Arsip
                          </span>
                          <span className="text-[11px] font-bold text-brand">{s.region_name}</span>
                          {s.is_my_spbu && (
                            <span className="rounded-full bg-prtgreen px-2 py-0.5 text-[10px] font-extrabold text-white">
                              SPBU Anda! 🎉
                            </span>
                          )}
                        </div>
                        <div className="mt-1 truncate text-sm font-extrabold text-navy">
                          {s.spbu_name} <span className="font-mono text-xs text-slate-500">({s.spbu_code})</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.city ? `${s.city} · ` : ""}
                          {s.memoed} selesai Memo · {s.arsip_rows} baris arsip tercatat
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-black text-prtgreen">{s.total_submissions}</div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Pengajuan</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer penyemangat bagi SPBU / Region */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-navy px-4 py-3 text-xs text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
              <span>
                {role === "ADMIN_SPBU" && mySpbuRank
                  ? mySpbuRank <= 3
                    ? `Luar biasa! SPBU Anda berada di Peringkat #${mySpbuRank} Nasional! Pertahankan! 🏆`
                    : `SPBU Anda saat ini di urutan #${mySpbuRank}. Yuk ajukan tertib arsip untuk tembus Top 3! 💪`
                  : role === "ADMIN_REGION" && myRegionRank
                    ? `Region Anda berada di Peringkat #${myRegionRank} dari ${regionStats.length} Region! Terus semangat! 🔥`
                    : "Semangat tertib arsip menuju ruang kerja SPBU yang rapi, aman, dan andal!"}
              </span>
            </div>
            {role === "ADMIN_SPBU" && (
              <Link href="/submissions/new" className="font-extrabold text-amber-300 hover:underline">
                + Ajukan Sekarang →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* MODAL KELOLA SLIDE BERANDA — KHUSUS ADMIN GS / PAM */}
      {canManageSlides && (
        <>
          <Modal
            open={manageOpen && !editSlide}
            wide
            onClose={() => setManageOpen(false)}
            title="Kelola Foto & Informasi Slide Beranda"
            footer={
              <>
                <button className="btn-ghost" onClick={() => setManageOpen(false)}>
                  Tutup
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setEditSlide({
                      form: { ...BLANK_SLIDE, sort_order: String(slides.length + 1) },
                    });
                    setSlideFiles([]);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Slide Baru
                </button>
              </>
            }
          >
            <div className="space-y-3">
              <p className="rounded-xl bg-softblue/70 p-3 text-xs text-navy">
                Atur foto kegiatan kearsipan dan pesan edukasi yang tampil pada slider halaman awal Beranda untuk seluruh pengguna.
              </p>
              <div className="space-y-2.5">
                {slides.map((s) => (
                  <div
                    key={s.slide_id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 ${
                      s.status !== "Aktif" ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                        {s.has_image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={s.image_url} alt={s.title} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="chip bg-softblue text-brand ring-blue-100">Urutan #{s.sort_order}</span>
                          <span className="chip bg-amber-50 text-amber-800 ring-amber-200">{s.badge}</span>
                          <span
                            className={`chip ${
                              s.status === "Aktif"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-slate-100 text-slate-500 ring-slate-200"
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <div className="mt-1 truncate font-bold text-navy">{s.title}</div>
                        <div className="truncate text-xs text-slate-500">{s.description}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setEditSlide({
                            id: s.slide_id,
                            form: {
                              title: s.title,
                              badge: s.badge,
                              description: s.description,
                              cta_label: s.cta_label,
                              cta_href: s.cta_href,
                              sort_order: String(s.sort_order),
                            },
                          });
                          setSlideFiles([]);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Ubah
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={busySlide}
                        onClick={() => toggleSlideStatus(s)}
                      >
                        <Power className="h-4 w-4" />
                        {s.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-prtred hover:bg-red-50"
                        onClick={() => setDelSlide(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Modal>

          <Modal
            open={!!editSlide}
            wide
            onClose={() => {
              if (!busySlide) {
                setEditSlide(null);
                setSlideFiles([]);
              }
            }}
            title={editSlide?.id ? "Ubah Foto & Informasi Slide" : "Tambah Slide Beranda"}
            footer={
              <>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setEditSlide(null);
                    setSlideFiles([]);
                  }}
                  disabled={busySlide}
                >
                  Kembali
                </button>
                <button
                  className="btn-primary"
                  onClick={saveSlide}
                  disabled={
                    busySlide ||
                    !editSlide ||
                    editSlide.form.title.trim().length < 3 ||
                    editSlide.form.description.trim().length < 5
                  }
                >
                  {busySlide && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Slide
                </button>
              </>
            }
          >
            {editSlide && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="label">
                      Judul Informasi <span className="text-prtred">*</span>
                    </label>
                    <input
                      className="input"
                      placeholder="Mis. Sosialisasi Pemusnahan Arsip Semester II"
                      value={editSlide.form.title}
                      onChange={(e) =>
                        setEditSlide({ ...editSlide, form: { ...editSlide.form, title: e.target.value } })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Urutan Tampil</label>
                    <input
                      type="number"
                      min={1}
                      className="input"
                      value={editSlide.form.sort_order}
                      onChange={(e) =>
                        setEditSlide({ ...editSlide, form: { ...editSlide.form, sort_order: e.target.value } })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label">Label Kategori</label>
                    <input
                      className="input"
                      placeholder="Mis. Info Kearsipan"
                      value={editSlide.form.badge}
                      onChange={(e) =>
                        setEditSlide({ ...editSlide, form: { ...editSlide.form, badge: e.target.value } })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Teks Tombol (opsional)</label>
                    <input
                      className="input"
                      placeholder="Mis. Baca Pedoman"
                      value={editSlide.form.cta_label}
                      onChange={(e) =>
                        setEditSlide({ ...editSlide, form: { ...editSlide.form, cta_label: e.target.value } })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Link Tujuan Tombol</label>
                    <input
                      className="input"
                      placeholder="/info atau /submissions"
                      value={editSlide.form.cta_href}
                      onChange={(e) =>
                        setEditSlide({ ...editSlide, form: { ...editSlide.form, cta_href: e.target.value } })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="label">
                    Isi Informasi / Pesan Kearsipan <span className="text-prtred">*</span>
                  </label>
                  <textarea
                    className="input min-h-[85px]"
                    placeholder="Tulis informasi singkat mengenai pengelolaan atau pemusnahan arsip…"
                    value={editSlide.form.description}
                    onChange={(e) =>
                      setEditSlide({ ...editSlide, form: { ...editSlide.form, description: e.target.value } })
                    }
                  />
                </div>

                <FileField
                  kind="image"
                  required={false}
                  label={
                    editSlide.id
                      ? "Ganti Foto Slide (.jpg / .png — kosongkan bila tetap memakai foto/ilustrasi saat ini)"
                      : "Unggah Foto Slide (.jpg / .png — opsional, bila kosong memakai ilustrasi GEMAS)"
                  }
                  hint="Disarankan foto lanskap rasio 16:9 atau 4:3"
                  accept=".jpg,.jpeg,.png"
                  files={slideFiles}
                  onChange={setSlideFiles}
                />
              </div>
            )}
          </Modal>

          <ConfirmModal
            open={!!delSlide}
            onClose={() => setDelSlide(null)}
            busy={busySlide}
            danger
            confirmLabel="Hapus Slide"
            title={`Hapus slide "${delSlide?.title || ""}"?`}
            message="Slide ini akan dihapus dari halaman Beranda."
            onConfirm={confirmDeleteSlide}
          />
        </>
      )}
    </div>
  );
}
