"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bot,
  ClipboardList,
  Clock,
  FileDown,
  FilePlus2,
  FileSpreadsheet,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Power,
  Settings2,
  Trash2,
} from "lucide-react";
import { SpbuScene } from "../art/SpbuScene";
import { Mascot } from "../art/Mascot";
import { DemoTag } from "../ui/kit";
import { Modal, ConfirmModal } from "../ui/Modal";
import { FileField } from "../ui/FileField";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { ROLE_LABEL, RoleId, STATUS, STATUS_STYLE } from "@/lib/constants";
import type { HomeSlideItem } from "@/lib/services/home";

const MENUS = [
  { href: "/dashboard", title: "Dashboard Monitoring", desc: "Pantau progres pengajuan, pooling FUPA, dan MEMO.", icon: LayoutDashboard, tone: "bg-brand" },
  { href: "/detail-monitoring", title: "Rincian Data Monitoring", desc: "Lihat tabel lengkap rincian tiap poin KPI dan grafik.", icon: ClipboardList, tone: "bg-navy" },
  { href: "/info", title: "Pusat Informasi Arsip", desc: "Pedoman, TKI, JRDP, buku saku, dan manual i-BOS.", icon: BookOpen, tone: "bg-brand-700" },
  { href: "/tarikan-ibos", title: "Data Arsip Tarikan i-BOS", desc: "Data tarikan arsip i-BOS per bulan dari Admin GS.", icon: FileSpreadsheet, tone: "bg-emerald-600" },
  { href: "/templates", title: "Pusat Template", desc: "Unduh template Form FUPA dan Daftar Arsip Usul Musnah.", icon: FileDown, tone: "bg-prtgreen" },
  { href: "/submissions", title: "Pengajuan Usul Musnah Arsip", desc: "Ajukan, review, pooling, dan catat MEMO.", icon: FilePlus2, tone: "bg-prtred" },
  { href: "/ask", title: "Tanya si GEMAS", desc: "Asisten AI berbasis dokumen resmi perusahaan.", icon: Bot, tone: "bg-gradient-to-br from-brand to-prtgreen" },
];

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

export function GeneralHomeView({
  role,
  userDisplayName,
  greetingName,
  isDemo,
  kpi,
  slides = [],
}: {
  role: RoleId;
  userDisplayName: string;
  greetingName: string;
  isDemo: boolean;
  kpi: any;
  slides?: HomeSlideItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [manageOpen, setManageOpen] = useState(false);
  const [editSlide, setEditSlide] = useState<{ id?: string; form: SlideForm } | null>(null);
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [delSlide, setDelSlide] = useState<HomeSlideItem | null>(null);
  const [busySlide, setBusySlide] = useState(false);

  const isPam = role === "ADMIN_PAM";
  const summary = [
    {
      label: "Menunggu review",
      v: kpi?.review ?? 0,
      s: STATUS.REVIEW,
      view: "review",
      desc: "Berkas baru SPBU, menunggu verifikasi Region",
    },
    {
      label: "Perlu revisi",
      v: kpi?.revision ?? 0,
      s: STATUS.REVISION,
      view: "revision",
      desc: "Dikembalikan ke SPBU untuk diperbaiki",
    },
    {
      label: "Disetujui",
      v: kpi?.approved ?? 0,
      s: STATUS.APPROVED,
      view: "approved",
      desc: "Lolos verifikasi, siap masuk tahap pooling",
    },
    {
      label: "Pooling",
      v: kpi?.pooled ?? 0,
      s: STATUS.POOLED,
      view: "pooled",
      desc: "Penggabungan usul SPBU ke FUPA Regional",
    },
    {
      label: "Sudah di-Memo",
      v: kpi?.memoed ?? 0,
      s: STATUS.MEMOED,
      view: "memoed",
      desc: "MEMO resmi diteruskan ke PAM / GS Pusat",
    },
  ];

  const alert =
    role === "ADMIN_REGION" && (kpi?.review ?? 0) > 0
      ? { text: `${kpi.review} pengajuan menunggu review Anda.`, href: "/submissions", icon: Clock, cls: "bg-amber-50 text-amber-800 ring-amber-100" }
      : role === "ADMIN_REGION" && (kpi?.approved ?? 0) > 0
        ? { text: `${kpi.approved} pengajuan disetujui dan siap di-pooling.`, href: "/submissions?tab=pooling", icon: Clock, cls: "bg-blue-50 text-brand ring-blue-100" }
        : null;

  const saveSlide = async () => {
    if (!editSlide) return;
    setBusySlide(true);
    try {
      const fd = new FormData();
      fd.set("action", editSlide.id ? "update" : "create");
      if (editSlide.id) fd.set("id", editSlide.id);
      Object.entries(editSlide.form).forEach(([k, v]) => fd.set(k, v));
      if (slideFiles[0]) fd.set("image", slideFiles[0]);
      await api("/api/home-slides", fd);
      toast("success", editSlide.id ? "Slide Beranda SPBU diperbarui." : "Slide baru berhasil ditambahkan.");
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

  return (
    <div className="space-y-6">
      {/* Header Banner Asli */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-600 to-navy p-6 text-white shadow-pop sm:p-10">
        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="chip bg-white/15 text-white ring-white/25">{ROLE_LABEL[role]}</span>
              {isDemo && <DemoTag />}
            </div>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">
              {greetingName ? `Halo, ${greetingName}!` : "Halo, Sahabat Arsip!"}
            </h1>
            <p className="mt-3 max-w-lg text-base text-white/85">
              Selamat datang di GEMAS. Pusat informasi dan monitoring pengelolaan arsip PT Pertamina Retail.
            </p>
            <p className="mt-1 text-sm text-white/70">{userDisplayName}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard" className="btn bg-white text-brand hover:bg-softblue">
                <LayoutDashboard className="h-4 w-4" />
                Buka Dashboard Monitoring
              </Link>
              <Link href="/ask" className="btn bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25">
                <Bot className="h-4 w-4" />
                Tanya si GEMAS
              </Link>
              {isPam && (
                <button onClick={() => setManageOpen(true)} className="btn bg-emerald-500 text-white hover:bg-emerald-600">
                  <Settings2 className="h-4 w-4" />
                  Kelola Slide Beranda SPBU
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <SpbuScene className="mx-auto w-full max-w-[560px] drop-shadow-2xl" />
          </div>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
      </section>

      {alert && (
        <Link href={alert.href} className={`flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold ring-1 ${alert.cls}`}>
          <alert.icon className="h-5 w-5" />
          {alert.text}
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      {/* Ringkasan Status Pengajuan */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
          Ringkasan status pengajuan {role === "ADMIN_REGION" ? "Region Anda" : "seluruh Region"}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href="/detail-monitoring?view=total"
            className="card flex flex-col justify-between border-emerald-200/90 bg-gradient-to-br from-emerald-50/70 via-emerald-50/30 to-white p-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-pop"
          >
            <div>
              <div className="text-2xl font-black text-emerald-600">{kpi?.total ?? 0}</div>
              <span className="chip mt-1.5 bg-emerald-100 font-bold text-emerald-800 ring-1 ring-emerald-300">
                Total pengajuan
              </span>
            </div>
            <p className="mt-2.5 text-[11px] leading-snug text-slate-500">
              Akumulasi seluruh usul musnah dari SPBU
            </p>
          </Link>
          {summary.map((s) => (
            <Link
              key={s.label}
              href={`/detail-monitoring?view=${s.view}`}
              className="card flex flex-col justify-between p-4 transition hover:-translate-y-0.5 hover:shadow-pop"
            >
              <div>
                <div className="text-2xl font-black text-navy">{s.v}</div>
                <span className={`chip mt-1.5 ${STATUS_STYLE[s.s]}`}>{s.label}</span>
              </div>
              <p className="mt-2.5 text-[11px] leading-snug text-slate-500">{s.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Menu Utama Asli (7 Menu Lengkap) */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Menu utama</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MENUS.map((m) => (
            <Link key={m.href} href={m.href} className="card group relative flex gap-4 overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-card ${m.tone}`}>
                <m.icon className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-navy">{m.title}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{m.desc}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-brand">
                  Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </span>
              </div>
              {m.href === "/ask" && <Mascot size={70} className="absolute -bottom-2 right-1 opacity-90" />}
            </Link>
          ))}
        </div>
      </section>

      {/* Modal Kelola Slide Beranda SPBU (Khusus Admin GS / PAM) */}
      {isPam && (
        <Modal
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          title="Kelola Foto & Informasi Slide Beranda SPBU"
          wide
          footer={<button className="btn-primary" onClick={() => setManageOpen(false)}>Selesai</button>}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <p className="text-xs text-slate-500">
                Slide ini akan ditampilkan di halaman Beranda khusus akun Admin SPBU.
              </p>
              <button
                className="btn-primary btn-sm"
                onClick={() => {
                  setEditSlide({ form: { ...BLANK_SLIDE } });
                  setSlideFiles([]);
                }}
              >
                <Plus className="h-4 w-4" />
                Tambah Slide Baru
              </button>
            </div>

            <div className="space-y-2.5">
              {slides.map((s, idx) => (
                <div key={s.slide_id} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 ${s.status === "Aktif" ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-softblue text-xs font-extrabold text-brand">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-navy truncate">{s.title}</span>
                        <span className={`chip ${s.status === "Aktif" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                          {s.status}
                        </span>
                        {s.has_image && (
                          <span className="chip bg-sky-50 text-brand ring-sky-200">
                            <ImageIcon className="h-3 w-3 mr-1" />
                            Foto
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate max-w-[480px]">{s.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
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
                      title="Ubah Slide"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="btn-ghost btn-sm"
                      disabled={busySlide}
                      onClick={() => toggleSlideStatus(s)}
                      title={s.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="btn-ghost btn-sm text-prtred hover:bg-red-50"
                      disabled={busySlide}
                      onClick={() => setDelSlide(s)}
                      title="Hapus Slide"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Form Tambah/Ubah Slide */}
      {isPam && (
        <Modal
          open={!!editSlide}
          onClose={() => setEditSlide(null)}
          title={editSlide?.id ? "Ubah Slide Beranda SPBU" : "Tambah Slide Beranda SPBU"}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setEditSlide(null)} disabled={busySlide}>
                Batal
              </button>
              <button
                className="btn-primary"
                onClick={saveSlide}
                disabled={busySlide || !editSlide?.form.title || !editSlide?.form.description}
              >
                {busySlide && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan Slide
              </button>
            </>
          }
        >
          {editSlide && (
            <div className="space-y-3">
              <div>
                <label className="label">Judul Informasi Slide *</label>
                <input
                  className="input"
                  placeholder="mis. Tertib Arsip SPBU, Operasional Lebih Aman!"
                  value={editSlide.form.title}
                  onChange={(e) => setEditSlide({ ...editSlide, form: { ...editSlide.form, title: e.target.value } })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Label Badge</label>
                  <input
                    className="input"
                    placeholder="mis. Info Kearsipan"
                    value={editSlide.form.badge}
                    onChange={(e) => setEditSlide({ ...editSlide, form: { ...editSlide.form, badge: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="label">Urutan Tampil (Sort Order)</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={editSlide.form.sort_order}
                    onChange={(e) => setEditSlide({ ...editSlide, form: { ...editSlide.form, sort_order: e.target.value } })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Isi / Keterangan Informasi *</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Tuliskan panduan atau pengumuman arsip untuk seluruh SPBU…"
                  value={editSlide.form.description}
                  onChange={(e) => setEditSlide({ ...editSlide, form: { ...editSlide.form, description: e.target.value } })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teks Tombol Aksi (Opsional)</label>
                  <input
                    className="input"
                    placeholder="mis. Buka Pusat Informasi"
                    value={editSlide.form.cta_label}
                    onChange={(e) => setEditSlide({ ...editSlide, form: { ...editSlide.form, cta_label: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="label">Tautan Tombol Aksi (Href)</label>
                  <input
                    className="input"
                    placeholder="mis. /info atau /ask"
                    value={editSlide.form.cta_href}
                    onChange={(e) => setEditSlide({ ...editSlide, form: { ...editSlide.form, cta_href: e.target.value } })}
                  />
                </div>
              </div>
              <div>
                <FileField
                  kind="image"
                  required={false}
                  label="Unggah Foto Slide (JPG/PNG, opsional)"
                  hint="Format foto: JPG atau PNG. Jika dikosongkan, slide akan menggunakan ilustrasi bawaan SPBU."
                  accept=".jpg,.jpeg,.png"
                  files={slideFiles}
                  onChange={setSlideFiles}
                />
              </div>
            </div>
          )}
        </Modal>
      )}

      {isPam && (
        <ConfirmModal
          open={!!delSlide}
          onClose={() => setDelSlide(null)}
          title="Hapus Slide Beranda SPBU?"
          message={`Slide "${delSlide?.title}" akan dihapus secara permanen.`}
          onConfirm={confirmDeleteSlide}
          busy={busySlide}
          danger
        />
      )}
    </div>
  );
}
