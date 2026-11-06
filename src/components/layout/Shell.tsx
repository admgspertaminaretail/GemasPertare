"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, ListOrdered, BookOpen, FileDown, FileSpreadsheet, FilePlus2, Bot, Home, Database, Users, ScrollText, ChevronsLeft, ChevronsRight,
  Menu, LogOut, UserCircle2, X, KeyRound, Loader2, Cloud,
} from "lucide-react";
import { GemasLogo, PertaminaLogo } from "../art/Logos";
import { DemoTag } from "../ui/kit";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";

export interface ShellUser { name: string; username: string; role: string; roleLabel: string; unit: string; demo: boolean }

const NAV = [
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
const ADMIN = [
  { href: "/admin/master", label: "Master Data", icon: Database, roles: ["ADMIN_PAM"] },
  { href: "/admin/users", label: "Pengguna", icon: Users, roles: ["ADMIN_PAM"] },
  { href: "/admin/database", label: "Database & Cloud", icon: Cloud, roles: ["ADMIN_PAM"] },
  { href: "/admin/activity", label: "Audit Trail", icon: ScrollText, roles: ["ADMIN_PAM", "ADMIN_REGION"] },
];

function BrandLogo() {
  // Logo korporat: public/brand/logo-pertamina-retail.png (PNG transparan)
  return <PertaminaLogo className="hidden h-9 md:block" />;
}

export function Shell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [profile, setProfile] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { setCollapsed(localStorage.getItem("gemas.sidebar") === "1"); }, []);
  useEffect(() => { setMobile(false); }, [path]);
  const toggle = () => { const v = !collapsed; setCollapsed(v); localStorage.setItem("gemas.sidebar", v ? "1" : "0"); };

  const logout = async () => {
    try { await api("/api/auth/logout", {}); } catch { /* abaikan */ }
    router.replace("/login"); router.refresh();
  };
  const changePw = async () => {
    setBusy(true);
    try { await api("/api/auth/password", pw); toast("success", "Kata sandi berhasil diubah."); setPw({ current: "", next: "" }); setProfile(false); }
    catch (e: any) { toast("error", e.message); } finally { setBusy(false); }
  };

  const active = (h: string) => (h === "/home" ? path === "/home" : path === h || path.startsWith(h + "/"));
  const items = [...NAV.map((n) => ({ ...n, roles: undefined as string[] | undefined })), ...ADMIN].filter((n) => !n.roles || n.roles.includes(user.role));

  const SidebarBody = ({ compact }: { compact: boolean }) => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 scroll-thin" aria-label="Navigasi utama">
      {items.map((n, i) => {
        const I = n.icon;
        const sep = n.href === "/admin/master" || (n.href === "/admin/activity" && user.role !== "ADMIN_PAM");
        return (
          <div key={n.href}>
            {sep && <div className={`mx-2 mb-2 mt-3 border-t border-white/15 pt-3 text-[10px] font-bold uppercase tracking-widest text-white/50 ${compact ? "hidden" : ""}`}>Administrasi</div>}
            <Link href={n.href} title={n.label} aria-current={active(n.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active(n.href) ? "bg-white text-brand shadow-card" : "text-white/85 hover:bg-white/10"} ${compact ? "justify-center" : ""}`}>
              <I className="h-5 w-5 shrink-0" />
              {!compact && <span className="truncate">{n.label}</span>}
            </Link>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* sidebar desktop */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-gradient-to-b from-navy to-brand-700 transition-all duration-200 lg:flex ${collapsed ? "w-[76px]" : "w-72"}`}>
        <div className={`flex h-16 items-center border-b border-white/10 px-4 ${collapsed ? "justify-center" : "gap-3"}`}>
          {collapsed
            ? <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1.5 shadow-card"><GemasLogo variant="icon" className="h-full" /></div>
            : <div className="flex h-12 items-center rounded-xl bg-white px-3 py-1.5 shadow-card"><GemasLogo className="h-full" /></div>}
        </div>
        <SidebarBody compact={collapsed} />
        <button onClick={toggle} className="m-3 flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/20" aria-label={collapsed ? "Perluas sidebar" : "Perkecil sidebar"}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Perkecil</>}
        </button>
      </aside>

      {/* drawer mobile */}
      {mobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setMobile(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 animate-slidein flex-col bg-gradient-to-b from-navy to-brand-700">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex h-12 items-center rounded-xl bg-white px-3 py-1.5 shadow-card"><GemasLogo className="h-full" /></div>
              <button onClick={() => setMobile(false)} aria-label="Tutup menu" className="text-white"><X className="h-6 w-6" /></button>
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
          <button onClick={() => setProfile(true)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-slate-50" aria-label="Profil pengguna">
            <UserCircle2 className="h-9 w-9 text-brand" />
            <div className="hidden leading-tight sm:block">
              <div className="max-w-[220px] truncate text-sm font-bold text-navy">{user.name}</div>
              <div className="max-w-[220px] truncate text-[11px] text-slate-500">{user.roleLabel} · {user.unit}</div>
            </div>
          </button>
          <button onClick={logout} className="btn-ghost btn-sm" aria-label="Logout"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Logout</span></button>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">{children}</main>
        <footer className="px-6 pb-5 text-center text-[11px] text-slate-400">GEMAS · PT Pertamina Retail · Pengelolaan Arsip Lebih Mudah, Terstruktur, dan Terpantau.</footer>
      </div>

      <Modal open={profile} onClose={() => setProfile(false)} title="Profil Pengguna" footer={<><button className="btn-ghost" onClick={() => setProfile(false)}>Tutup</button><button className="btn-primary" onClick={changePw} disabled={busy || !pw.current || !pw.next}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Ubah Kata Sandi</button></>}>
        <dl className="mb-5 grid grid-cols-3 gap-y-2 text-sm">
          <dt className="text-slate-500">Nama</dt><dd className="col-span-2 font-semibold">{user.name}</dd>
          <dt className="text-slate-500">Username</dt><dd className="col-span-2 font-mono text-xs">{user.username}</dd>
          <dt className="text-slate-500">Role</dt><dd className="col-span-2 font-semibold">{user.roleLabel}</dd>
          <dt className="text-slate-500">Unit / Region</dt><dd className="col-span-2 font-semibold">{user.unit}</dd>
        </dl>
        <div className="space-y-3 rounded-xl bg-cloud p-4">
          <div className="text-sm font-bold">Ubah kata sandi</div>
          <div><label className="label" htmlFor="pwc">Kata sandi saat ini</label><input id="pwc" type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div><label className="label" htmlFor="pwn">Kata sandi baru</label><input id="pwn" type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><p className="mt-1 text-xs text-slate-500">Minimal 8 karakter, kombinasi huruf dan angka.</p></div>
        </div>
      </Modal>
    </div>
  );
}
