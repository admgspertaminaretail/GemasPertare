"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Flame,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Stamp,
} from "lucide-react";
import { Empty } from "../ui/kit";
import { Modal } from "../ui/Modal";
import { FilePreview, PreviewTarget } from "../ui/FilePreview";
import { Mascot } from "../art/Mascot";
import { useToast } from "../ui/Toast";
import { api } from "@/lib/client";
import { fmtDate, fmtSize } from "@/lib/format";
import { KNOWLEDGE_CATEGORIES } from "@/lib/constants";

type Doc = Record<string, string>;
const blank = {
  title: "",
  category: KNOWLEDGE_CATEGORIES[0],
  description: "",
  version: "",
  managed_by: "Admin PAM",
  status: "Aktif",
  use_for_ai: "1",
};

const FLOW_STEPS = [
  {
    step: "01",
    title: "Cek Usia & JRDP",
    desc: "Pastikan masa simpan aktif + inaktif arsip sudah lewat sesuai tabel JRDP.",
    icon: Clock,
    bg: "from-sky-50 to-blue-50",
    ring: "ring-sky-200",
    badge: "bg-brand text-white",
    iconCls: "text-brand",
  },
  {
    step: "02",
    title: "Data & Foto Fisik",
    desc: "Cek Data Arsip Per Bulan, isi Excel Daftar Arsip, lalu potret boks arsip.",
    icon: Camera,
    bg: "from-emerald-50 to-teal-50",
    ring: "ring-emerald-200",
    badge: "bg-prtgreen text-white",
    iconCls: "text-emerald-600",
  },
  {
    step: "03",
    title: "Ajukan & Review",
    desc: "Unggah Daftar Arsip & PDF Arsip Usul Musnah di GEMAS untuk direview Region.",
    icon: FileCheck2,
    bg: "from-amber-50 to-orange-50",
    ring: "ring-amber-200",
    badge: "bg-amber-500 text-white",
    iconCls: "text-amber-600",
  },
  {
    step: "04",
    title: "Pooling & MEMO",
    desc: "Masuk Pooling Regional & terbit MEMO ke PAM sebelum eksekusi musnah resmi.",
    icon: ShieldCheck,
    bg: "from-indigo-50 to-purple-50",
    ring: "ring-indigo-200",
    badge: "bg-indigo-600 text-white",
    iconCls: "text-indigo-600",
  },
];

const FUN_RETENTION_CHART = [
  { label: "Arsip Aktif", ilustrasi: 2, info: "Dipakai rutin di unit kerja SPBU", color: "#0EA5E9" },
  { label: "Arsip Inaktif", ilustrasi: 3, info: "Disimpan rapi di boks berlabel tahun", color: "#6366F1" },
  { label: "Cek JRDP", ilustrasi: 5, info: "Evaluasi batas retensi (mis. 5+ thn sesuai jenis)", color: "#F59E0B" },
  { label: "Siap Usul", ilustrasi: 6, info: "Diajukan resmi lewat GEMAS hingga MEMO", color: "#69B345" },
];

const CAT_COLORS: Record<string, { iconBg: string; chip: string; bar: string; Icon: any }> = {
  Pedoman: { iconBg: "bg-brand text-white", chip: "bg-softblue text-brand ring-blue-200", bar: "#006CB7", Icon: BookOpen },
  TKI: { iconBg: "bg-sky-600 text-white", chip: "bg-sky-50 text-sky-700 ring-sky-200", bar: "#0284C7", Icon: FileCheck2 },
  "Jadwal Retensi (JRDP)": { iconBg: "bg-amber-500 text-white", chip: "bg-amber-50 text-amber-800 ring-amber-200", bar: "#F59E0B", Icon: Clock },
  "Buku Saku": { iconBg: "bg-prtgreen text-white", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "#69B345", Icon: Sparkles },
  "Sprint (Surat Perintah)": { iconBg: "bg-indigo-600 text-white", chip: "bg-indigo-50 text-indigo-700 ring-indigo-200", bar: "#4F46E5", Icon: Stamp },
  "Manual Book": { iconBg: "bg-teal-600 text-white", chip: "bg-teal-50 text-teal-700 ring-teal-200", bar: "#0D9488", Icon: FileSpreadsheet },
};

export function InfoView({ docs, canManage }: { docs: Doc[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [chartTab, setChartTab] = useState<"siklus" | "pustaka">("siklus");
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [edit, setEdit] = useState<{ id?: string; form: typeof blank } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const cats = useMemo(() => {
    const present = new Set(docs.map((d) => d.category));
    const ordered = KNOWLEDGE_CATEGORIES.filter((c) => present.has(c));
    for (const c of present) if (!ordered.includes(c)) ordered.push(c);
    return ordered;
  }, [docs]);

  const categoryChartData = useMemo(
    () =>
      KNOWLEDGE_CATEGORIES.map((c) => ({
        category: c,
        short:
          c === "Jadwal Retensi (JRDP)"
            ? "JRDP"
            : c === "Sprint (Surat Perintah)"
              ? "Sprint"
              : c,
        jumlah: docs.filter((d) => d.category === c).length,
        color: CAT_COLORS[c]?.bar || "#006CB7",
      })),
    [docs]
  );

  const list = docs.filter(
    (d) =>
      (!cat || d.category === cat) &&
      (!q || (d.title + " " + d.description + " " + d.category).toLowerCase().includes(q.toLowerCase()))
  );

  const openPreview = (d: Doc) => {
    setPreview({
      kind: "knowledge",
      id: d.doc_id,
      name: d.file_name || `${d.title}.pdf`,
      mime: d.mime || "application/pdf",
    });
  };

  const save = async () => {
    if (!edit) return;
    const fd = new FormData();
    fd.set("action", edit.id ? "update" : "create");
    if (edit.id) fd.set("id", edit.id);
    Object.entries(edit.form).forEach(([k, v]) => fd.set(k, v));
    if (file) fd.set("file", file);
    setBusy(true);
    try {
      const r = await api("/api/knowledge", fd);
      toast("success", `Dokumen disimpan. Status AI: ${r.ai}`);
      setEdit(null);
      setFile(null);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };
  const reindex = async (id: string) => {
    setBusy(true);
    const f = new FormData();
    f.set("action", "reindex");
    f.set("id", id);
    try {
      const r = await api("/api/knowledge", f);
      toast("success", `Status AI: ${r.ai}`);
      router.refresh();
    } catch (e: any) {
      toast("error", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* BAGIAN ATAS: GRAFIK & INFOGRAFIS LUCU TENTANG PEMUSNAHAN ARSIP */}
      <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        {/* Kartu Infografis 4 Langkah + Maskot GEMAS */}
        <div className="card relative overflow-hidden border border-sky-100 bg-gradient-to-br from-white via-softblue/40 to-emerald-50/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">
                <Sparkles className="h-3.5 w-3.5" />
                Infografis Pintar Kearsipan
              </span>
              <h2 className="mt-1.5 text-lg font-extrabold text-navy">
                Kenali 4 Langkah Resmi Pemusnahan Arsip!
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold text-prtred ring-1 ring-red-200">
              <Flame className="h-3.5 w-3.5" />
              Dilarang Musnah Mandiri
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FLOW_STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.step}
                  className={`group rounded-2xl bg-gradient-to-br ${s.bg} p-3.5 ring-1 ${s.ring} transition hover:-translate-y-0.5 hover:shadow-sm`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${s.badge}`}>
                      Langkah {s.step}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Icon className={`h-4 w-4 ${s.iconCls}`} />
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-extrabold text-navy">{s.title}</div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{s.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/90 p-3 ring-1 ring-blue-100">
            <Mascot size={56} className="shrink-0 animate-floaty" />
            <div className="text-xs leading-relaxed text-slate-600">
              <b className="text-navy">Tips si GEMAS:</b> Semua dokumen pedoman, JRDP, maupun{" "}
              <b className="text-indigo-700">Sprint (Surat Perintah)</b> di bawah ini bisa langsung kamu{" "}
              <b className="text-brand">Preview / Baca di layar</b> tanpa harus download dulu!
            </div>
          </div>
        </div>

        {/* Kartu Grafik Interaktif Siklus Retensi & Komposisi Pustaka */}
        <div className="card flex flex-col justify-between border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/25 to-amber-50/30 p-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100/80 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                  Grafik Visual Arsip
                </span>
                <h3 className="mt-1 text-base font-extrabold text-navy">
                  {chartTab === "siklus" ? "Ilustrasi Perjalanan Usia Arsip" : "Peta Dokumen Pusat Informasi"}
                </h3>
              </div>
              <div className="flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setChartTab("siklus")}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    chartTab === "siklus" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-navy"
                  }`}
                >
                  Siklus Retensi
                </button>
                <button
                  type="button"
                  onClick={() => setChartTab("pustaka")}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    chartTab === "pustaka" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-navy"
                  }`}
                >
                  Koleksi Info
                </button>
              </div>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {chartTab === "siklus"
                ? "Gambaran tahapan masa simpan arsip sebelum boleh diusulkan musnah sesuai JRDP."
                : "Klik batang kategori untuk menyaring daftar dokumen di bawah secara instan."}
            </p>

            <div className="mt-3 h-[195px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartTab === "siklus" ? (
                  <BarChart data={FUN_RETENTION_CHART} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#163B63", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} unit=" th" />
                    <Tooltip
                      cursor={{ fill: "rgba(0,108,183,0.06)" }}
                      formatter={(val: any, _n: any, item: any) => [
                        `Tahap ${item?.payload?.label} (${item?.payload?.info})`,
                        "Info",
                      ]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                    />
                    <Bar dataKey="ilustrasi" radius={[10, 10, 4, 4]} barSize={36}>
                      {FUN_RETENTION_CHART.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <BarChart
                    data={categoryChartData}
                    margin={{ top: 8, right: 12, left: -22, bottom: 0 }}
                    onClick={(st: any) => {
                      const clicked = st?.activePayload?.[0]?.payload?.category;
                      if (clicked) setCat((prev) => (prev === clicked ? "" : clicked));
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="short" tick={{ fontSize: 10.5, fill: "#163B63", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "rgba(79,70,229,0.06)" }}
                      formatter={(val: any, _n: any, item: any) => [`${val} dokumen`, item?.payload?.category]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                    />
                    <Bar dataKey="jumlah" radius={[10, 10, 4, 4]} barSize={30} className="cursor-pointer">
                      {categoryChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-900 ring-1 ring-emerald-200/70">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="h-4 w-4 text-prtgreen" />
              {docs.length} Dokumen Resmi Terdaftar
            </span>
            <span className="text-[11px] font-semibold text-emerald-700">
              Mode Baca Instan (Tanpa Wajib Unduh)
            </span>
          </div>
        </div>
      </section>

      {/* FILTER & PENCARIAN DOKUMEN */}
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Cari Pedoman, JRDP, Sprint (Surat Perintah), Buku Saku…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari dokumen"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["", ...cats].map((c) => (
            <button
              key={c || "all"}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                cat === c ? "bg-brand text-white ring-brand" : "bg-white text-navy ring-slate-200 hover:bg-softblue"
              }`}
            >
              {c || "Semua"}
            </button>
          ))}
        </div>
        {canManage && (
          <button
            className="btn-primary"
            onClick={() => {
              setEdit({ form: { ...blank } });
              setFile(null);
            }}
          >
            <Plus className="h-4 w-4" />
            Tambah Dokumen
          </button>
        )}
      </div>

      {/* DAFTAR DOKUMEN (BISA LANGSUNG PREVIEW TANPA HARUS DOWNLOAD) */}
      {list.length === 0 ? (
        <div className="card">
          <Empty title="Dokumen tidak ditemukan" text="Ubah kata kunci atau kategori." />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => {
            const has = !!d.storage_ref;
            const style = CAT_COLORS[d.category] || {
              iconBg: "bg-brand text-white",
              chip: "bg-softblue text-brand ring-blue-100",
              bar: "#006CB7",
              Icon: FileText,
            };
            const CatIcon = style.Icon;
            return (
              <article key={d.doc_id} className="card flex flex-col p-5 transition hover:shadow-pop">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${style.iconBg}`}>
                    <CatIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold leading-snug text-navy">{d.title}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className={`chip ${style.chip}`}>{d.category}</span>
                      <span
                        className={`chip ${
                          d.status === "Aktif"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-100 text-slate-500 ring-slate-200"
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </div>
                </div>
                {d.description && <p className="mt-3 text-sm text-slate-600">{d.description}</p>}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-400">Versi</dt>
                  <dd className="font-semibold">{d.version || "Ringkasan Digital"}</dd>
                  <dt className="text-slate-400">Tanggal upload</dt>
                  <dd className="font-semibold">{d.uploaded_at ? fmtDate(d.uploaded_at) : "Tersedia"}</dd>
                  <dt className="text-slate-400">Pengelola</dt>
                  <dd className="font-semibold">{d.managed_by || "Admin PAM"}</dd>
                  <dt className="text-slate-400">Format</dt>
                  <dd className="truncate font-semibold" title={d.file_name || "Ringkasan PDF"}>
                    {has ? fmtSize(d.size) : "Pratinjau PDF"}
                  </dd>
                </dl>
                {canManage && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-cloud px-2.5 py-1.5 text-[11px] text-slate-600">
                    <Sparkles className="h-3.5 w-3.5 text-brand" />
                    Basis AI: {d.use_for_ai === "1" ? d.ai_status || "-" : "Tidak dipakai"}
                  </div>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <button className="btn-primary btn-sm" onClick={() => openPreview(d)}>
                    <Eye className="h-4 w-4" />
                    Baca / Preview
                  </button>
                  <a className="btn-ghost btn-sm" href={`/api/files/knowledge/${d.doc_id}?download=1`}>
                    <Download className="h-4 w-4" />
                    Unduh
                  </a>
                  {canManage && (
                    <>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setEdit({
                            id: d.doc_id,
                            form: {
                              title: d.title,
                              category: KNOWLEDGE_CATEGORIES.includes(d.category) ? d.category : KNOWLEDGE_CATEGORIES[0],
                              description: d.description,
                              version: d.version,
                              managed_by: d.managed_by,
                              status: d.status,
                              use_for_ai: d.use_for_ai || "1",
                            },
                          });
                          setFile(null);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        {has ? "Ubah" : "Unggah File"}
                      </button>
                      {has && (
                        <button
                          className="btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => reindex(d.doc_id)}
                          title="Indeks ulang untuk AI"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <FilePreview target={preview} onClose={() => setPreview(null)} />

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? "Ubah Dokumen Pusat Informasi" : "Tambah Dokumen Pusat Informasi"}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdit(null)} disabled={busy}>
              Batal
            </button>
            <button className="btn-primary" onClick={save} disabled={busy || !edit?.form.title}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}Simpan
            </button>
          </>
        }
      >
        {edit && (
          <div className="space-y-3">
            <div>
              <label className="label">Judul *</label>
              <input
                className="input"
                value={edit.form.title}
                onChange={(e) => setEdit({ ...edit, form: { ...edit.form, title: e.target.value } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Kategori</label>
                <select
                  className="input"
                  value={edit.form.category}
                  onChange={(e) => setEdit({ ...edit, form: { ...edit.form, category: e.target.value } })}
                >
                  {KNOWLEDGE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Versi</label>
                <input
                  className="input"
                  placeholder="mis. 2.0"
                  value={edit.form.version}
                  onChange={(e) => setEdit({ ...edit, form: { ...edit.form, version: e.target.value } })}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={edit.form.status}
                  onChange={(e) => setEdit({ ...edit, form: { ...edit.form, status: e.target.value } })}
                >
                  <option>Aktif</option>
                  <option>Tidak Berlaku</option>
                </select>
              </div>
              <div>
                <label className="label">Pengelola</label>
                <input
                  className="input"
                  value={edit.form.managed_by}
                  onChange={(e) => setEdit({ ...edit, form: { ...edit.form, managed_by: e.target.value } })}
                />
              </div>
            </div>
            <div>
              <label className="label">Deskripsi</label>
              <textarea
                className="input min-h-[70px]"
                value={edit.form.description}
                onChange={(e) => setEdit({ ...edit, form: { ...edit.form, description: e.target.value } })}
              />
            </div>
            <div>
              <label className="label">
                File (PDF/Excel/Word){edit.id ? " — kosongkan jika tidak diganti" : " *"}
              </label>
              <input
                type="file"
                accept=".pdf,.xlsx,.docx"
                className="input"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={edit.form.use_for_ai === "1"}
                onChange={(e) => setEdit({ ...edit, form: { ...edit.form, use_for_ai: e.target.checked ? "1" : "0" } })}
              />
              <span>
                Jadikan sumber pengetahuan <b>Tanya si GEMAS</b> (hanya PDF yang berisi teks yang dapat diindeks).
              </span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
