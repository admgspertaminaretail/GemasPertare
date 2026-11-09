"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  ListOrdered,
  BookOpen,
  FileDown,
  FileSpreadsheet,
  FilePlus2,
  Home,
  LayoutDashboard,
  Bot,
  Database,
  Users,
  ScrollText,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  LogOut,
  UserCircle2,
  X,
  KeyRound,
  Loader2,
  Cloud,
  BellRing,
  CheckCircle2,
  Sparkles,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { GemasLogo, PertaminaLogo } from "../art/Logos";
import { Mascot } from "../art/Mascot";
import { DemoTag } from "../ui/kit";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";

export interface ShellUser {
  name: string;
  username: string;
  role: string;
  roleLabel: string;
  unit: string;
  demo: boolean;
  profileName: string;
  employeeId: string;
  phone: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles?: string[];
}

// Navigasi lengkap untuk akun selain SPBU (ADMIN_PAM & ADMIN_REGION): tetap persis seperti semula
const GENERAL_NAV: NavItem[] = [
  { href: "/home", label: "Beranda", icon: Home },
  { href: "/dashboard", label: "Dashboard Monitoring", icon: LayoutDashboard },
  { href: "/detail-monitoring", label: "Rincian Data Monitoring", icon: ClipboardList },
  { href: "/kronologis-pengajuan", label: "Kronologis ID Pengajuan", icon: ListOrdered },
  { href: "/info", label: "Pusat Informasi Arsip", icon: BookOpen },
  { href: "/tarikan-ibos", label: "Data Arsip Tarikan i-BOS", icon: FileSpreadsheet },
  { href: "/templates", label: "Pusat Template", icon: FileDown },
  { href: "/submissions", label: "Pengajuan Usul Musnah Arsip", icon: FilePlus2 },
  { href: "/ask", label: "Tanya si GEMAS", icon: Bot },
];

interface SpbuNavItem {
  href: string;
  label: string;
  sublabel: string;
  icon: any;
  badge?: string;
}

// Khusus Admin SPBU: layout dirancang terstruktur dan profesional sesuai peran operasional
const SPBU_PRIMARY_NAV: SpbuNavItem[] = [
  {
    href: "/home",
    label: "Beranda",
    sublabel: "Dashboard ringkas & capaian",
    icon: Home,
  },
  {
    href: "/submissions",
    label: "Pengajuan Usul Musnah",
    sublabel: "Formulir & unggah berkas arsip",
    icon: FilePlus2,
    badge: "Utama",
  },
  {
    href: "/info",
    label: "Pusat Informasi Arsip",
    sublabel: "Pedoman, JRDP & Sprint",
    icon: BookOpen,
  },
];

const SPBU_SECONDARY_NAV: SpbuNavItem[] = [
  {
    href: "/detail-monitoring",
    label: "Rincian Data Monitoring",
    sublabel: "Tabel status berkas SPBU",
    icon: ClipboardList,
  },
  {
    href: "/kronologis-pengajuan",
    label: "Kronologis ID Pengajuan",
    sublabel: "Buku catatan & riwayat ID",
    icon: ListOrdered,
  },
];

// Sekat Administrasi
const ADMIN_NAV: NavItem[] = [
  { href: "/admin/master", label: "Master Data", icon: Database, roles: ["ADMIN_PAM"] },
  { href: "/admin/users", label: "Pengguna", icon: Users, roles: ["ADMIN_PAM"] },
  { href: "/admin/database", label: "Database & Cloud", icon: Cloud, roles: ["ADMIN_PAM"] },
  { href: "/admin/activity", label: "Audit Trail", icon: ScrollText, roles: ["ADMIN_PAM", "ADMIN_REGION"] },
];

function BrandLogo() {
  return <PertaminaLogo className="hidden h-9 md:block" />;
}

export function Shell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [profile, setProfile] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);

  const [empForm, setEmpForm] = useState({
    profile_name: user.profileName || "",
    employee_id: user.employeeId || "",
    phone: user.phone || "",
  });
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPw, setBusyPw] = useState(false);

  useEffect(() => {
    setEmpForm({
      profile_name: user.profileName || "",
      employee_id: user.employeeId || "",
      phone: user.phone || "",
    });
  }, [user.profileName, user.employeeId, user.phone]);

  useEffect(() => { setCollapsed(localStorage.getItem("gemas.sidebar") === "1"); }, []);
  useEffect(() => { setMobile(false); }, [path]);
  const toggle = () => { const v = !collapsed; setCollapsed(v); localStorage.setItem("gemas.sidebar", v ? "1" : "0"); };

  const isProfileIncomplete = !user.profileName.trim() || !user.employeeId.trim() || !user.phone.trim();

  const logout = async () => {
    try { await api("/api/auth/logout", {}); } catch { /* abaikan */ }
    router.replace("/login"); router.refresh();
  };

  const saveProfile = async () => {
    setBusyProfile(true);
    try {
      await api("/api/auth/profile", empForm);
      toast("success", "Profil pegawai berhasil disimpan ke database akun.");
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusyProfile(false);
    }
  };

  const changePw = async () => {
    setBusyPw(true);
    try {
      await api("/api/auth/password", pw);
      toast("success", "Kata sandi berhasil diubah.");
      setPw({ current: "", next: "" });
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusyPw(false);
    }
  };

  const active = (h: string) => (h === "/home" ? path === "/home" : path === h || path.startsWith(h + "/"));
  const filterRole = (arr: NavItem[]) => arr.filter((n) => !n.roles || n.roles.includes(user.role));

  const isSpbu = user.role === "ADMIN_SPBU";
  const generalItems = filterRole(GENERAL_NAV);
  const spbuPrimaryItems = SPBU_PRIMARY_NAV;
  const spbuSecondaryItems = SPBU_SECONDARY_NAV;
  const adminItems = filterRole(ADMIN_NAV);
  const askActive = active("/ask");

  const renderLink = (n: NavItem, compact: boolean) => {
    const I = n.icon;
    return (
      <Link
        key={n.href}
        href={n.href}
        title={n.label}
        aria-current={active(n.href) ? "page" : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
          active(n.href) ? "bg-white text-brand shadow-card" : "text-white/85 hover:bg-white/10"
        } ${compact ? "justify-center" : ""}`}
      >
        <I className="h-5 w-5 shrink-0" />
        {!compact && <span className="truncate">{n.label}</span>}
      </Link>
    );
  };

  const renderSpbuLink = (n: SpbuNavItem, compact: boolean) => {
    const I = n.icon;
    const isActive = active(n.href);
    if (compact) {
      return (
        <Link
          key={n.href}
          href={n.href}
          title={`${n.label} — ${n.sublabel}`}
          aria-current={isActive ? "page" : undefined}
          className={`relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-150 ${
            isActive
              ? "bg-white text-navy shadow-md ring-1 ring-black/5"
              : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          {isActive && (
            <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand" />
          )}
          <I className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
        </Link>
      );
    }
    return (
      <Link
        key={n.href}
        href={n.href}
        title={n.label}
        aria-current={isActive ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150 ${
          isActive
            ? "bg-white text-navy shadow-md ring-1 ring-black/5"
            : "text-slate-200 hover:bg-white/[0.08] hover:text-white"
        }`}
      >
        {/* Active indicator bar */}
        {isActive && (
          <span className="absolute -left-1 top-2.5 bottom-2.5 w-1.5 rounded-full bg-brand" />
        )}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
            isActive
              ? "bg-brand/10 text-brand"
              : "bg-white/[0.06] text-slate-300 group-hover:bg-white/[0.12] group-hover:text-white"
          }`}
        >
          <I className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center justify-between gap-1">
            <span className={`truncate text-xs font-bold leading-tight ${isActive ? "text-navy" : "text-white"}`}>
              {n.label}
            </span>
            {n.badge && (
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${
                  isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30"
                }`}
              >
                {n.badge}
              </span>
            )}
          </div>
          <div
            className={`truncate text-[10.5px] leading-snug mt-0.5 ${
              isActive ? "text-slate-500 font-medium" : "text-slate-400 group-hover:text-slate-300"
            }`}
          >
            {n.sublabel}
          </div>
        </div>
      </Link>
    );
  };

  const SidebarBody = ({ compact }: { compact: boolean }) => (
    <div className="flex flex-1 flex-col overflow-hidden">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 scroll-thin" aria-label="Navigasi utama">
        {isSpbu ? (
          <>
            {/* SPBU Unit Operational Badge */}
            {!compact && (
              <div className="mx-1 mb-2.5 rounded-2xl bg-white/[0.06] border border-white/10 p-2.5 text-left shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] animate-pulse" />
                    Unit Admin SPBU
                  </span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                    {user.username}
                  </span>
                </div>
                <div className="mt-1 truncate text-xs font-bold text-white" title={user.unit}>
                  {user.unit}
                </div>
              </div>
            )}

            {/* Bagian 1 Khusus SPBU: Prosedur & Layanan Kearsipan */}
            {!compact && (
              <div className="mx-2 mb-1 mt-0.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400/80">
                <span>Operasional Arsip</span>
                <span className="text-[9px] font-semibold text-slate-500">3 Menu</span>
              </div>
            )}
            <div className="space-y-1">
              {spbuPrimaryItems.map((n) => renderSpbuLink(n, compact))}
            </div>

            {/* Bagian 2 Khusus SPBU: Monitoring & Riwayat (Sekat Terstruktur) */}
            <div className={`my-3 border-t border-white/10 ${compact ? "mx-1" : "mx-2 pt-2.5"}`}>
              {!compact && (
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-400/80">
                  <span>Monitoring &amp; Riwayat</span>
                  <span className="text-[9px] font-semibold text-slate-500">2 Menu</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              {spbuSecondaryItems.map((n) => renderSpbuLink(n, compact))}
            </div>
          </>
        ) : (
          <>
            {/* Menu Asli Lengkap untuk Akun Lain (Admin PAM & PIC Region) */}
            {generalItems.map((n) => renderLink(n, compact))}

            {/* Sekat Administrasi */}
            {adminItems.length > 0 && (
              <>
                <div className={`my-2.5 border-t border-white/20 ${compact ? "mx-1" : "mx-2 pt-2.5"}`}>
                  {!compact && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Administrasi
                    </span>
                  )}
                </div>
                {adminItems.map((n) => renderLink(n, compact))}
              </>
            )}
          </>
        )}
      </nav>

      {/* Paling Bawah: Asisten Kearsipan Copilot (Desain Profesional untuk SPBU) */}
      {isSpbu && (
        <div className="border-t border-white/10 p-3">
          {compact ? (
            <Link
              href="/ask"
              title="Tanya si GEMAS (Asisten Kearsipan AI)"
              className={`relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${
                askActive
                  ? "bg-white text-navy shadow-lg ring-2 ring-brand"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/10"
              }`}
            >
              <div className="relative">
                <Mascot size={32} />
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-navy" />
              </div>
            </Link>
          ) : (
            <Link
              href="/ask"
              className={`group block rounded-2xl border p-3 transition-all duration-200 ${
                askActive
                  ? "bg-white text-navy border-white shadow-lg ring-2 ring-brand/30"
                  : "bg-gradient-to-b from-white/[0.08] to-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.12] text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0.5 shadow-sm transition group-hover:scale-105 ${
                    askActive ? "bg-brand/10 ring-1 ring-brand/20" : "bg-white/95"
                  }`}
                >
                  <Mascot size={34} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-navy" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        askActive ? "text-brand" : "text-amber-300"
                      }`}
                    >
                      <Sparkles className="h-3 w-3" />
                      Asisten Kearsipan
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        askActive ? "bg-brand/10 text-brand" : "bg-white/15 text-white/80"
                      }`}
                    >
                      AI
                    </span>
                  </div>
                  <div
                    className={`truncate text-xs font-bold leading-tight mt-0.5 ${
                      askActive ? "text-navy" : "text-white"
                    }`}
                  >
                    Tanya si GEMAS
                  </div>
                </div>
              </div>
              <p
                className={`mt-2 text-[10.5px] leading-relaxed line-clamp-2 ${
                  askActive ? "text-slate-600" : "text-slate-300/80"
                }`}
              >
                Konsultasi masa retensi JRDP, syarat berkas, &amp; alur usul musnah SPBU.
              </p>
              <div
                className={`mt-2.5 flex items-center justify-between border-t pt-2 text-[10.5px] font-bold transition ${
                  askActive
                    ? "border-slate-100 text-brand"
                    : "border-white/10 text-white/90 group-hover:text-white"
                }`}
              >
                <span>Buka Konsultasi</span>
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </div>
            </Link>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* sidebar desktop */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-[#0B2138] via-navy to-[#0F2D4E] border-r border-white/[0.08] transition-all duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-72"}`}>
        <div className={`flex h-16 items-center border-b border-white/[0.08] px-4 ${collapsed ? "justify-center" : "gap-3"}`}>
          {collapsed
            ? <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-card"><GemasLogo variant="icon" className="h-full" /></div>
            : <div className="flex h-12 items-center rounded-xl bg-white px-3 py-1.5 shadow-card"><GemasLogo className="h-full" /></div>}
        </div>
        <SidebarBody compact={collapsed} />
        <button onClick={toggle} className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-xl bg-white/[0.08] border border-white/10 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.15] hover:text-white transition" aria-label={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Perkecil Menu</>}
        </button>
      </aside>

      {/* drawer mobile */}
      {mobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" onClick={() => setMobile(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 animate-slidein flex-col bg-gradient-to-b from-[#0B2138] via-navy to-[#0F2D4E] border-r border-white/[0.08]">
            <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-4">
              <div className="flex h-12 items-center rounded-xl bg-white px-3 py-1.5 shadow-card"><GemasLogo className="h-full" /></div>
              <button onClick={() => setMobile(false)} aria-label="Tutup menu" className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"><X className="h-6 w-6" /></button>
            </div>
            <SidebarBody compact={false} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-100 bg-white/90 px-3 backdrop-blur sm:px-5">
          <button className="rounded-lg p-2 text-navy hover:bg-slate-100 lg:hidden" onClick={() => setMobile(true)} aria-label="Buka menu"><Menu className="h-6 w-6" /></button>
          <Link href="/home" className="flex items-center lg:hidden" aria-label="GEMAS"><GemasLogo className="h-9" /></Link>
          <div className="hidden min-w-0 lg:block">
            <div className="text-sm font-extrabold text-navy">GEMAS</div>
            <div className="truncate text-[11px] text-slate-500">General Services Monitoring &amp; Archive System</div>
          </div>
          <div className="ml-2"><BrandLogo /></div>
          <div className="flex-1" />
          {user.demo && <DemoTag className="hidden sm:inline-flex" />}

          <button
            onClick={() => setProfile(true)}
            className={`relative flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition ${
              isProfileIncomplete
                ? "bg-amber-50/90 ring-1 ring-amber-300 hover:bg-amber-100/80"
                : "hover:bg-slate-50"
            }`}
            aria-label="Profil pengguna"
          >
            <div className="relative">
              <UserCircle2 className="h-9 w-9 text-brand" />
              {isProfileIncomplete && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-prtred opacity-75" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-prtred ring-2 ring-white" />
                </span>
              )}
            </div>
            <div className="hidden leading-tight sm:block">
              <div className="flex items-center gap-1.5">
                <span className="max-w-[190px] truncate text-sm font-bold text-navy">{user.name}</span>
                {isProfileIncomplete && (
                  <span className="rounded-full bg-prtred px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                    Lengkapi
                  </span>
                )}
              </div>
              <div className="max-w-[220px] truncate text-[11px] text-slate-500">{user.roleLabel} · {user.unit}</div>
            </div>
          </button>

          <button onClick={logout} className="btn-ghost btn-sm" aria-label="Logout"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span></button>
        </header>

        {/* Notifikasi Non-Blokir Lengkapi Data Akun Profil di Pojok Kanan Atas */}
        {isProfileIncomplete && !notifDismissed && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-softblue px-4 py-3 text-xs sm:text-sm text-navy shadow-sm ring-1 ring-amber-200">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <BellRing className="h-4 w-4" />
                </span>
                <div>
                  <b className="text-navy">Lengkapi Profil Akun Anda:</b>{" "}
                  <span className="text-slate-600">
                    Mohon isi <b>Nama Lengkap</b>, <b>Nomor Pegawai</b>, dan <b>Nomor Telepon</b> pada menu Profil kanan atas (opsional, Anda tetap dapat mengakses seluruh fitur).
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setProfile(true)} className="btn-primary btn-sm">
                  <UserCheck className="h-3.5 w-3.5" />
                  Isi Data Profil
                </button>
                <button
                  onClick={() => setNotifDismissed(true)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-white/70 hover:text-navy"
                  aria-label="Tutup notifikasi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">{children}</main>
        <footer className="px-6 pb-5 text-center text-[11px] text-slate-400">GEMAS · PT Pertamina Retail · Pengelolaan Arsip Lebih Mudah, Terstruktur, dan Terpantau.</footer>
      </div>

      <Modal
        open={profile}
        wide
        onClose={() => setProfile(false)}
        title="Profil Akun & Data Pegawai"
        footer={
          <button className="btn-ghost" onClick={() => setProfile(false)}>
            Tutup
          </button>
        }
      >
        <div className="space-y-5">
          <dl className="grid grid-cols-3 gap-y-2 rounded-xl bg-cloud p-3.5 text-xs sm:text-sm">
            <dt className="text-slate-500">Username Akun</dt>
            <dd className="col-span-2 font-mono font-semibold text-navy">{user.username}</dd>
            <dt className="text-slate-500">Role</dt>
            <dd className="col-span-2 font-semibold text-navy">{user.roleLabel}</dd>
            <dt className="text-slate-500">Unit / Region</dt>
            <dd className="col-span-2 font-semibold text-navy">{user.unit}</dd>
          </dl>

          {/* Form Data Pegawai -> Tersimpan ke Sheet USERS bersama data akun */}
          <div className="space-y-3 rounded-2xl border border-blue-100 bg-softblue/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-navy">1. Identitas &amp; Kontak Pegawai</h3>
                <p className="text-xs text-slate-500">
                  Data ini tersimpan langsung di sheet database bersama akun Anda dan menampilkan sapaan nama Anda di Beranda.
                </p>
              </div>
              {!isProfileIncomplete && (
                <span className="chip bg-emerald-50 text-emerald-700 ring-emerald-200">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Lengkap
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="prof-name">
                  Nama Lengkap Pegawai <span className="font-extrabold text-prtred">*</span>
                </label>
                <input
                  id="prof-name"
                  className="input bg-white"
                  placeholder="Masukkan nama lengkap Anda…"
                  value={empForm.profile_name}
                  onChange={(e) => setEmpForm({ ...empForm, profile_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="prof-nopek">
                  Nomor Pegawai <span className="font-extrabold text-prtred">*</span>
                </label>
                <input
                  id="prof-nopek"
                  className="input bg-white"
                  placeholder="Mis. 75012345"
                  value={empForm.employee_id}
                  onChange={(e) => setEmpForm({ ...empForm, employee_id: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="prof-phone">
                  Nomor Telepon / WhatsApp <span className="font-extrabold text-prtred">*</span>
                </label>
                <input
                  id="prof-phone"
                  type="tel"
                  className="input bg-white"
                  placeholder="Mis. 081234567890"
                  value={empForm.phone}
                  onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                className="btn-primary"
                onClick={saveProfile}
                disabled={
                  busyProfile ||
                  empForm.profile_name.trim().length < 2 ||
                  empForm.employee_id.trim().length < 2 ||
                  empForm.phone.trim().length < 7
                }
              >
                {busyProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                Simpan Identitas Pegawai
              </button>
            </div>
          </div>

          {/* Form Ubah Kata Sandi */}
          <div className="space-y-3 rounded-2xl bg-cloud p-4">
            <div className="text-sm font-bold text-navy">2. Ubah Kata Sandi</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="pwc">Kata sandi saat ini</label>
                <input id="pwc" type="password" autoComplete="current-password" className="input bg-white" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="pwn">Kata sandi baru</label>
                <input id="pwn" type="password" autoComplete="new-password" className="input bg-white" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Minimal 8 karakter, kombinasi huruf dan angka.</p>
              <button className="btn-ghost ring-1 ring-slate-200 bg-white" onClick={changePw} disabled={busyPw || !pw.current || !pw.next}>
                {busyPw ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Ubah Kata Sandi
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
