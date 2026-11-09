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
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Crown,
  FilePlus2,
  FileStack,
  Filter,
  Flame,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Medal,
  MessageSquare,
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
  userRegionName = "",
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
  regions = [],
  regionKpis = {},
  regionalSpbus = [],
}: {
  role: RoleId;
  userDisplayName: string;
  greetingName: string;
  userRegionName?: string;
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
  regions?: { region_id: string; region_name: string; short_name: string }[];
  regionKpis?: Record<string, any>;
  regionalSpbus?: SpbuRankItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const canManageSlides = role === "ADMIN_PAM";

  // Filter 7 Region khusus Admin PAM / Head Office ("ALL" = Semua Region / Nasional)
  const [pamRegionFilter, setPamRegionFilter] = useState<string>("ALL");
  const [regionChartView, setRegionChartView] = useState<"status" | "spbu">("status");

  const activeSlides = slides.filter((s) => s.status === "Aktif");
  const displaySlides = activeSlides.length > 0 ? activeSlides : slides;

  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [leaderTab, setLeaderTab] = useState<"region" | "spbu">("region");
  const [askInput, setAskInput] = useState("");

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

  const activeKpi =
    role === "ADMIN_PAM" && regionKpis?.[pamRegionFilter]
      ? regionKpis[pamRegionFilter]
      : kpi;

  const activeRegionName =
    pamRegionFilter === "ALL"
      ? "Semua Region (Nasional)"
      : regions.find((r) => r.region_id === pamRegionFilter)?.region_name || pamRegionFilter;

  // Data Progress Pengajuan (pengganti Dashboard Monitoring)
  const totalScoped = activeKpi?.total || 0;
  const stages = [
    {
      label: "Menunggu Review",
      desc: "Menunggu verifikasi Region",
      count: activeKpi?.review || 0,
      color: "bg-amber-400",
      text: "text-amber-700",
      bg: "bg-amber-50",
      view: "review",
      status: STATUS.REVIEW,
    },
    {
      label: "Perlu Revisi",
      desc: "Dikembalikan untuk diperbaiki",
      count: activeKpi?.revision || 0,
      color: "bg-prtred",
      text: "text-prtred",
      bg: "bg-red-50",
      view: "revision",
      status: STATUS.REVISION,
    },
    {
      label: "Disetujui Region",
      desc: "Lolos verifikasi, siap pooling",
      count: activeKpi?.approved || 0,
      color: "bg-prtgreen",
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      view: "approved",
      status: STATUS.APPROVED,
    },
    {
      label: "Pooling",
      desc: "Penggabungan ke FUPA",
      count: activeKpi?.pooled || 0,
      color: "bg-brand",
      text: "text-brand",
      bg: "bg-softblue",
      view: "pooled",
      status: STATUS.POOLED,
    },
    {
      label: "Sudah Di-Memo",
      desc: "MEMO resmi diteruskan ke PAM",
      count: activeKpi?.memoed || 0,
      color: "bg-navy",
      text: "text-navy",
      bg: "bg-slate-100",
      view: "memoed",
      status: STATUS.MEMOED,
    },
  ];
  const progressedPct = totalScoped > 0 ? Math.round(((activeKpi?.approvedOrBeyond || 0) / totalScoped) * 100) : 0;

  const regionChartData = regionStats.map((r) => ({
    ...r,
    name: r.short_name,
    "Total Pengajuan": r.total_submissions,
    "Selesai (Di-Memo)": r.memoed,
  }));

  const regionalStatusChartData = [
    { name: "Review", label: "Menunggu Review", count: activeKpi?.review || 0, fill: "#F59E0B" },
    { name: "Revisi", label: "Perlu Revisi", count: activeKpi?.revision || 0, fill: "#E52329" },
    { name: "Disetujui", label: "Disetujui", count: activeKpi?.approved || 0, fill: "#69B345" },
    { name: "Pooling", label: "Pooling", count: activeKpi?.pooled || 0, fill: "#006CB7" },
    { name: "Di-Memo", label: "Selesai (Di-Memo)", count: activeKpi?.memoed || 0, fill: "#163B63" },
  ];

  const regionalSpbuList = (regionalSpbus && regionalSpbus.length > 0)
    ? regionalSpbus
    : topSpbus.filter((s) => s.region_name.includes(userRegionName || ""));

  const regionalSpbuChartData = regionalSpbuList.slice(0, 8).map((s: SpbuRankItem) => ({
    name: s.spbu_name.replace(/^SPBU\s*[-–—]?\s*/i, "").split(" ")[0].slice(0, 10),
    fullName: s.spbu_name,
    code: s.spbu_code,
    "Total Pengajuan": s.total_submissions,
    "Selesai (Di-Memo)": s.memoed,
  }));

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
              <span className="chip bg-white/15 text-white ring-white/25">
                {role === "ADMIN_REGION" && userRegionName
                  ? `${ROLE_LABEL[role]} — ${userRegionName}`
                  : ROLE_LABEL[role]}
              </span>
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
            {role === "ADMIN_REGION" && (
              <Link href="/submissions" className="btn bg-white text-navy shadow-card hover:bg-slate-100">
                <CheckCircle2 className="h-4 w-4 text-brand" />
                Review Pengajuan SPBU
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
              {role === "ADMIN_SPBU"
                ? "Progres Pengajuan Usul Musnah SPBU Anda"
                : role === "ADMIN_REGION"
                  ? `Progres Pengajuan Usul Musnah SPBU ${userRegionName || "Region Anda"}`
                  : "Progres Pengajuan Usul Musnah SPBU COCO"}
            </h2>
            <p className="text-xs text-slate-500">
              {role === "ADMIN_SPBU"
                ? "Klik kartu atau tahapan progres untuk melihat tabel lengkap di Rincian Data Monitoring."
                : role === "ADMIN_REGION"
                  ? `Pantau proses pengajuan usul musnah dari seluruh SPBU di ${userRegionName || "Region Anda"}.`
                  : pamRegionFilter === "ALL"
                    ? "Pantau alur penyelesaian usul musnah arsip SPBU COCO dari 7 Region PT Pertamina Retail."
                    : `Pantau alur penyelesaian usul musnah arsip SPBU COCO di wilayah ${activeRegionName}.`}
            </p>
          </div>
          <Link
            href={
              role === "ADMIN_PAM" && pamRegionFilter !== "ALL"
                ? `/detail-monitoring?region=${pamRegionFilter}`
                : "/detail-monitoring?view=total"
            }
            className="text-xs font-bold text-brand hover:underline"
          >
            Buka Rincian Data Monitoring →
          </Link>
        </div>

        {/* Filter 7 Region khusus Admin PAM / Head Office */}
        {role === "ADMIN_PAM" && regions.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-softblue text-brand">
                <Filter className="h-4 w-4" />
              </span>
              <div>
                <span className="text-xs font-bold text-navy">Filter Wilayah Region:</span>
                <span className="ml-1.5 text-[11px] text-slate-500">
                  (Aktif: <b>{activeRegionName}</b>)
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPamRegionFilter("ALL")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  pamRegionFilter === "ALL"
                    ? "bg-navy text-white shadow-sm ring-2 ring-navy/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-navy"
                }`}
              >
                Semua Region (Nasional)
              </button>
              {regions.map((r) => (
                <button
                  key={r.region_id}
                  type="button"
                  onClick={() => setPamRegionFilter(r.region_id)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                    pamRegionFilter === r.region_id
                      ? "bg-brand text-white shadow-sm ring-2 ring-brand/30"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-navy"
                  }`}
                >
                  {r.short_name || r.region_name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[310px_1fr]">
          {/* HIGHLIGHT KARTU TOTAL PENGAJUAN */}
          <Link
            href={
              role === "ADMIN_PAM" && pamRegionFilter !== "ALL"
                ? `/detail-monitoring?region=${pamRegionFilter}`
                : "/detail-monitoring?view=total"
            }
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
                {role === "ADMIN_SPBU"
                  ? "Transaksi pengajuan dari SPBU Anda"
                  : role === "ADMIN_REGION"
                    ? `${activeKpi.spbuSubmitted || 0} dari ${activeKpi.totalSpbu || 0} SPBU di ${userRegionName || "Region Anda"} telah mengajukan`
                    : pamRegionFilter === "ALL"
                      ? `${activeKpi.spbuSubmitted || 0} dari ${activeKpi.totalSpbu || 0} SPBU COCO (Nasional) telah mengajukan`
                      : `${activeKpi.spbuSubmitted || 0} dari ${activeKpi.totalSpbu || 0} SPBU di ${activeRegionName} telah mengajukan`}
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
                    <b>{activeKpi.approvedOrBeyond || 0}</b> pengajuan ({progressedPct}%) telah disetujui / masuk tahap Pooling &amp; MEMO
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
                    href={
                      role === "ADMIN_PAM" && pamRegionFilter !== "ALL"
                        ? `/detail-monitoring?view=${st.view}&region=${pamRegionFilter}`
                        : `/detail-monitoring?view=${st.view}`
                    }
                    className={`group flex flex-col justify-between rounded-2xl p-3 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-card ${st.bg}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`h-2.5 w-2.5 rounded-full ${st.color}`} />
                        <span className="text-[11px] font-bold text-slate-400">{pct}%</span>
                      </div>
                      <div className={`mt-1.5 text-2xl font-extrabold ${st.text}`}>{st.count}</div>
                      <div className="mt-0.5 text-xs font-bold text-navy group-hover:underline">{st.label}</div>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-tight text-slate-500">{st.desc}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 3. CHARTS TOTAL PENGAJUAN 7 REGION & PERINGKAT TOP 3 TERAKTIF */}
      <section className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        {/* KARTU KIRI: GRAFIK MONITORING (ADMIN PAM: 7 REGION, PIC REGION: KHUSUS REGION SENDIRI) */}
        <div className="card flex flex-col justify-between border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card">
          {role === "ADMIN_PAM" ? (
            /* ================= TAMPILAN ADMIN PAM (7 REGION NASIONAL) ================= */
            <>
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
                              {r.region_name}
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
                    <Bar dataKey="Total Pengajuan" fill="#006CB7" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Selesai (Di-Memo)" fill="#0F2C4B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda Korporat PAM */}
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center justify-center gap-5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-[#006CB7]" />
                    <span className="font-semibold text-slate-700">Total Pengajuan</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm bg-[#0F2C4B]" />
                    <span className="font-semibold text-slate-700">Selesai (Di-Memo)</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Data grafik diperbarui otomatis dari seluruh pengajuan Region I s.d. VII.
                  </span>
                  <span className="font-bold text-navy">{regionStats.length} Region Aktif</span>
                </div>
              </div>
            </>
          ) : (
            /* ================= TAMPILAN KHUSUS PIC REGION (HANYA REGION SENDIRI) ================= */
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 ring-1 ring-emerald-200">
                    <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                    Statistik Wilayah {userRegionName || "Region Anda"}
                  </div>
                  <h2 className="mt-1.5 text-lg font-extrabold text-navy">
                    Grafik Pengajuan {userRegionName || "Region Anda"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Total <b>{activeKpi?.total || 0}</b> pengajuan dari <b>{activeKpi?.spbuSubmitted || 0}</b> unit SPBU aktif di wilayah {userRegionName || "Region Anda"}.
                  </p>
                </div>

                {/* Sub-tab view: Status vs Unit SPBU */}
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setRegionChartView("status")}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      regionChartView === "status" ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
                    }`}
                  >
                    Status Pengajuan
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegionChartView("spbu")}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      regionChartView === "spbu" ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"
                    }`}
                  >
                    Unit SPBU ({regionalSpbuList.length})
                  </button>
                </div>
              </div>

              <div className="mt-4 h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {regionChartView === "status" ? (
                    <BarChart data={regionalStatusChartData} margin={{ top: 10, right: 12, left: -10, bottom: 5 }}>
                      <CartesianGrid vertical={false} stroke="#E5EAF1" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: "#163B63" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-2xl bg-navy p-3 text-xs text-white shadow-pop">
                              <div className="font-extrabold text-amber-300">{d.label}</div>
                              <div className="mt-1">
                                Jumlah: <b>{d.count} pengajuan</b>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="count" name="Jumlah Pengajuan" radius={[6, 6, 0, 0]}>
                        {regionalStatusChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={regionalSpbuChartData} margin={{ top: 10, right: 12, left: -10, bottom: 5 }}>
                      <CartesianGrid vertical={false} stroke="#E5EAF1" strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "#163B63" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-2xl bg-navy p-3.5 text-xs text-white shadow-pop">
                              <div className="font-extrabold text-amber-300">{d.fullName}</div>
                              <div className="text-[11px] text-sky-200">{d.code}</div>
                              <div className="mt-2 space-y-1 border-t border-white/15 pt-2">
                                <div>Total Pengajuan: <b>{d["Total Pengajuan"]}</b></div>
                                <div>Selesai Di-Memo: <b>{d["Selesai (Di-Memo)"]}</b></div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="Total Pengajuan" fill="#006CB7" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Selesai (Di-Memo)" fill="#0F2C4B" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Legenda Korporat PIC Region */}
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                {regionChartView === "status" ? (
                  <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
                    <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" /><span>Review</span></div>
                    <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#E52329]" /><span>Revisi</span></div>
                    <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#69B345]" /><span>Disetujui</span></div>
                    <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#006CB7]" /><span>Pooling</span></div>
                    <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#163B63]" /><span>Selesai (Di-Memo)</span></div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-center gap-5 text-xs">
                    <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#006CB7]" /><span className="font-semibold text-slate-700">Total Pengajuan</span></div>
                    <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#0F2C4B]" /><span className="font-semibold text-slate-700">Selesai (Di-Memo)</span></div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50/60 px-4 py-2 text-xs text-emerald-900 border border-emerald-100">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Menampilkan data khusus operasional wilayah {userRegionName || "Region Anda"}.
                  </span>
                  <span className="font-bold text-emerald-800">{activeKpi?.totalSpbu || regionalSpbuList.length} SPBU Terdaftar</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* PERINGKAT TOP 3 TERAKTIF — APRESIASI TERTIB ARSIP EKSEKUTIF */}
        <div className="card flex flex-col justify-between border border-slate-200/80 bg-white p-5 sm:p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-200/70">
                <Trophy className="h-3.5 w-3.5 text-amber-600" />
                Klasemen Kepatuhan Arsip
              </div>
              <h2 className="mt-1.5 text-lg font-extrabold text-navy">
                Peringkat Top 3 Teraktif
              </h2>
              <p className="text-xs text-slate-500">
                Apresiasi bagi Region &amp; SPBU paling sigap menuntaskan usul musnah arsip.
              </p>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60">
              <button
                type="button"
                onClick={() => setLeaderTab("region")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  leaderTab === "region"
                    ? "bg-white text-navy shadow-sm"
                    : "text-slate-600 hover:text-navy"
                }`}
              >
                Top 3 Region
              </button>
              <button
                type="button"
                onClick={() => setLeaderTab("spbu")}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  leaderTab === "spbu"
                    ? "bg-white text-navy shadow-sm"
                    : "text-slate-600 hover:text-navy"
                }`}
              >
                Top 3 SPBU
              </button>
            </div>
          </div>

          {/* Kartu Peringkat Top 3 - Gaya Metallic Corporate */}
          <div className="mt-4 space-y-2.5">
            {leaderTab === "region" ? (
              topRegions.map((r, i) => {
                const rankMeta =
                  i === 0
                    ? {
                        card: "border-amber-200/90 bg-gradient-to-r from-amber-50/60 via-amber-50/15 to-white",
                        badge: "bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-2 ring-amber-100",
                        num: "01",
                        label: "Peringkat 1 Nasional",
                        labelCls: "bg-amber-100/90 text-amber-900",
                        icon: <Crown className="h-3 w-3 text-amber-700" />,
                      }
                    : i === 1
                      ? {
                          card: "border-slate-200 bg-gradient-to-r from-slate-100/70 via-slate-50/20 to-white",
                          badge: "bg-gradient-to-br from-slate-400 to-slate-600 text-white ring-2 ring-slate-100",
                          num: "02",
                          label: "Peringkat 2 Nasional",
                          labelCls: "bg-slate-200/80 text-slate-800",
                          icon: <Medal className="h-3 w-3 text-slate-600" />,
                        }
                      : {
                          card: "border-orange-200/80 bg-gradient-to-r from-orange-50/50 via-amber-50/10 to-white",
                          badge: "bg-gradient-to-br from-amber-700 to-orange-800 text-white ring-2 ring-orange-100",
                          num: "03",
                          label: "Peringkat 3 Nasional",
                          labelCls: "bg-orange-100/80 text-orange-950",
                          icon: <Award className="h-3 w-3 text-orange-700" />,
                        };
                return (
                  <div
                    key={r.region_id}
                    className={`rounded-2xl border p-3.5 transition hover:shadow-card ${rankMeta.card}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-black shadow-sm ${rankMeta.badge}`}
                      >
                        {rankMeta.num}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${rankMeta.labelCls}`}
                          >
                            {rankMeta.icon}
                            {rankMeta.label}
                          </span>
                          {r.is_my_region && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-prtred px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                              Region Anda
                            </span>
                          )}
                        </div>
                        <div className="truncate text-base font-extrabold text-navy">
                          {r.region_name}
                          {r.pic_name && (
                            <span className="ml-1.5 text-xs font-semibold text-brand">· {r.pic_name}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          <b>{r.spbu_submitted}</b> dari {r.total_spbu} SPBU aktif mengajukan ({r.participation_pct}% partisipasi)
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-navy">{r.total_submissions}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pengajuan</div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : topSpbus.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                Belum ada pengajuan SPBU. Jadilah SPBU pertama yang menempati Peringkat 1! 🚀
              </div>
            ) : (
              topSpbus.map((s, i) => {
                const rankMeta =
                  i === 0
                    ? {
                        card: "border-amber-200/90 bg-gradient-to-r from-amber-50/60 via-amber-50/15 to-white",
                        badge: "bg-gradient-to-br from-amber-400 to-amber-600 text-white ring-2 ring-amber-100",
                        num: "01",
                        label: "Peringkat 1 · SPBU Teraktif",
                        labelCls: "bg-amber-100/90 text-amber-900",
                      }
                    : i === 1
                      ? {
                          card: "border-slate-200 bg-gradient-to-r from-slate-100/70 via-slate-50/20 to-white",
                          badge: "bg-gradient-to-br from-slate-400 to-slate-600 text-white ring-2 ring-slate-100",
                          num: "02",
                          label: "Peringkat 2 · SPBU Teraktif",
                          labelCls: "bg-slate-200/80 text-slate-800",
                        }
                      : {
                          card: "border-orange-200/80 bg-gradient-to-r from-orange-50/50 via-amber-50/10 to-white",
                          badge: "bg-gradient-to-br from-amber-700 to-orange-800 text-white ring-2 ring-orange-100",
                          num: "03",
                          label: "Peringkat 3 · SPBU Teraktif",
                          labelCls: "bg-orange-100/80 text-orange-950",
                        };
                return (
                  <div
                    key={s.spbu_id}
                    className={`rounded-2xl border p-3.5 transition hover:shadow-card ${rankMeta.card}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-black shadow-sm ${rankMeta.badge}`}
                        >
                          {rankMeta.num}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${rankMeta.labelCls}`}
                            >
                              {rankMeta.label}
                            </span>
                            <span className="text-[11px] font-bold text-brand">{s.region_name}</span>
                            {s.is_my_spbu && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                SPBU Anda
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-sm font-extrabold text-navy">
                            {s.spbu_name} <span className="font-mono text-xs text-slate-500">({s.spbu_code})</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {s.city ? `${s.city} · ` : ""}
                            {s.memoed} selesai Memo · {s.arsip_rows} baris arsip tercatat
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-2xl font-black text-navy">{s.total_submissions}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pengajuan</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer penyemangat bagi SPBU / Region */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-navy to-[#163B63] px-4 py-3 text-xs text-white shadow-sm">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="font-medium text-white/95">
                {role === "ADMIN_SPBU" && mySpbuRank
                  ? mySpbuRank <= 3
                    ? `Luar biasa! SPBU Anda berada di Peringkat #${mySpbuRank} Nasional! Pertahankan ketertiban arsip Anda.`
                    : `SPBU Anda saat ini berada di urutan #${mySpbuRank}. Tingkatkan ketertiban arsip untuk menembus Top 3!`
                  : role === "ADMIN_REGION" && myRegionRank
                    ? `Region Anda berada di Peringkat #${myRegionRank} dari ${regionStats.length} Region.`
                    : "Tertib arsip mendukung ruang operasional SPBU yang bersih, aman, dan siap audit berkala."}
              </span>
            </div>
            {role === "ADMIN_SPBU" && (
              <Link
                href="/submissions/new"
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/15 px-3 py-1.5 font-bold text-white ring-1 ring-white/20 transition hover:bg-white hover:text-navy"
              >
                + Buat Pengajuan
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* 4. AKSES MENU UTAMA */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
          Akses Menu Utama
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/dashboard"
            className="card group flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-card">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy group-hover:text-brand">Dashboard Monitoring</h3>
              <p className="truncate text-xs text-slate-500">Pantau progres &amp; funnel MEMO</p>
            </div>
          </Link>
          <Link
            href="/detail-monitoring"
            className="card group flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-navy text-white shadow-card">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy group-hover:text-brand">Rincian Data Monitoring</h3>
              <p className="truncate text-xs text-slate-500">Tabel lengkap seluruh KPI</p>
            </div>
          </Link>
          <Link
            href="/submissions"
            className="card group flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-prtred text-white shadow-card">
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy group-hover:text-brand">Pengajuan Usul Musnah</h3>
              <p className="truncate text-xs text-slate-500">
                {role === "ADMIN_SPBU" ? "Buat & pantau usul musnah" : "Review, pooling & catat MEMO"}
              </p>
            </div>
          </Link>
          <Link
            href="/info"
            className="card group flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:shadow-pop"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-card">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy group-hover:text-brand">Pusat Informasi Arsip</h3>
              <p className="truncate text-xs text-slate-500">Pedoman, TKI, JRDP &amp; manual</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. TANYA SI GEMAS — ASISTEN RESMI KEARSIPAN */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-softblue/30 to-blue-50/50 p-6 sm:p-8 shadow-card">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] items-center">
          {/* Sisi Kiri: Maskot & Input Tanya Langsung */}
          <div className="space-y-4">
            <div className="flex items-center gap-3.5">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-card ring-1 ring-blue-100">
                <Mascot size={58} mood="happy" className="animate-floaty" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-brand">
                    Asisten Cerdas Kearsipan
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Online Siap Membantu
                  </span>
                </div>
                <h2 className="mt-1 text-xl sm:text-2xl font-black text-navy">
                  Tanya si GEMAS
                </h2>
                <p className="text-xs text-slate-500">
                  Konsultasikan jadwal retensi berkas, tata cara usul musnah, atau data tarikan i-BOS.
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Bingung dokumen mana yang sudah habis masa retensinya? Atau butuh panduan pengisian berkas berita acara? Tanyakan langsung di sini dan si GEMAS akan memberikan rujukan resmi pedoman Pertamina Retail.
            </p>

            {/* Form Input Pertanyaan Cepat */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = askInput.trim();
                if (q) {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("gemas:ask", { detail: { question: q } }));
                  }
                  setAskInput("");
                }
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                placeholder="Tulis pertanyaan Anda seputar kearsipan di sini…"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-4 pr-32 text-xs sm:text-sm text-navy shadow-sm transition placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-4 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={!askInput.trim()}
                className="absolute right-2 flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Tanya GEMAS</span>
              </button>
            </form>

            {/* Chips Saran Pertanyaan */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Pilihan Pertanyaan Cepat:
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "Berapa tahun masa retensi bukti kas/setoran BBM?",
                  "Apa saja syarat berkas pengajuan usul musnah?",
                  "Bagaimana cara download Data Arsip Tarikan i-BOS?",
                  "Apa bedanya Formulir FUPA dan Daftar Arsip Usul Musnah?",
                ].map((promptText) => (
                  <button
                    key={promptText}
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("gemas:ask", { detail: { question: promptText } }));
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-blue-100 bg-white px-3 py-1.5 text-left text-xs font-semibold text-brand transition hover:border-brand hover:bg-softblue shadow-sm"
                  >
                    <MessageSquare className="h-3 w-3 text-brand" />
                    <span>{promptText}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sisi Kanan: 3 Keunggulan Asisten GEMAS */}
          <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/90 p-5 backdrop-blur shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rujukan Resmi &amp; Akurat
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-brand">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-navy">Berdasarkan Pedoman Resmi PT Pertamina Retail</div>
                  <div className="text-[11px] text-slate-500">Jawaban menyertakan nomor dokumen dan nomor halaman JRDP resmi.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-navy">Format &amp; Template Terpadu</div>
                  <div className="text-[11px] text-slate-500">Menyediakan tautan langsung ke template daftar arsip dan panduan i-BOS.</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-800">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-navy">Tersedia Kapan Saja 24/7</div>
                  <div className="text-[11px] text-slate-500">Petugas SPBU dapat berkonsultasi kapan saja saat memilah berkas di lapangan.</div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <Link
                href="/ask"
                className="flex items-center justify-between rounded-xl bg-cloud px-3 py-2 text-xs font-bold text-brand hover:bg-softblue"
              >
                <span>Buka Percakapan Penuh di Halaman Tanya si GEMAS</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
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
