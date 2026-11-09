import { getStore } from "../db";
import { HttpError, SessionUser } from "../auth";
import { Row } from "../schema";
import { STATUS } from "../constants";
import { saveFile, validateUpload } from "../storage";
import { logActivity, nextId, nowIso } from "./core";
import { getDashboard } from "./monitoring";

export interface HomeSlideItem {
  slide_id: string;
  title: string;
  badge: string;
  description: string;
  cta_label: string;
  cta_href: string;
  has_image: boolean;
  image_url: string;
  sort_order: number;
  status: string;
  updated_by: string;
  updated_at: string;
  is_demo: boolean;
}

export interface RegionRankItem {
  region_id: string;
  region_name: string;
  short_name: string;
  pic_name: string;
  total_spbu: number;
  spbu_submitted: number;
  participation_pct: number;
  total_submissions: number;
  approved_or_beyond: number;
  memoed: number;
  is_my_region: boolean;
}

export interface SpbuRankItem {
  spbu_id: string;
  spbu_code: string;
  spbu_name: string;
  city: string;
  region_id: string;
  region_name: string;
  total_submissions: number;
  memoed: number;
  approved_or_beyond: number;
  arsip_rows: number;
  is_my_spbu: boolean;
}

let slidesSeededPromise: Promise<void> | null = null;

async function ensureDefaultSlides() {
  if (slidesSeededPromise) return slidesSeededPromise;
  slidesSeededPromise = (async () => {
    try {
      const store = await getStore();
      const existing = await store.list("HOME_SLIDES");
      if (existing.length > 0) return;
      const t = nowIso();
      const defaults: Row[] = [
        {
          slide_id: "SLD-001",
          title: "Tertib Arsip SPBU, Operasional Lebih Aman & Rapi!",
          badge: "Info Kearsipan",
          description:
            "Pilah arsip operasional SPBU secara berkala setiap bulan. Arsip yang tertata rapi memudahkan audit dan menjaga ruang penyimpanan tetap lega.",
          cta_label: "Buka Pusat Informasi",
          cta_href: "/info",
          image_ref: "",
          file_name: "",
          mime: "",
          sort_order: "1",
          status: "Aktif",
          updated_by: "Admin GS / PAM",
          updated_at: t,
          is_demo: "1",
        },
        {
          slide_id: "SLD-002",
          title: "Kenali Jadwal Retensi Dokumen Perusahaan (JRDP)",
          badge: "Edukasi JRDP",
          description:
            "Pastikan masa simpan aktif dan inaktif dokumen telah terpenuhi sesuai JRDP sebelum mengajukan usul musnah arsip melalui GEMAS.",
          cta_label: "Pelajari JRDP & Pedoman",
          cta_href: "/info",
          image_ref: "",
          file_name: "",
          mime: "",
          sort_order: "2",
          status: "Aktif",
          updated_by: "Admin GS / PAM",
          updated_at: t,
          is_demo: "1",
        },
        {
          slide_id: "SLD-003",
          title: "Dilarang Memusnahkan Arsip Tanpa Prosedur Resmi!",
          badge: "Penting · Kepatuhan",
          description:
            "Setiap pemusnahan arsip wajib melalui pengajuan Daftar Arsip Usul Musnah, dokumentasi foto fisik, review PIC Region, hingga Pooling & MEMO resmi.",
          cta_label: "Tanya si GEMAS",
          cta_href: "/ask",
          image_ref: "",
          file_name: "",
          mime: "",
          sort_order: "3",
          status: "Aktif",
          updated_by: "Admin GS / PAM",
          updated_at: t,
          is_demo: "1",
        },
      ];
      await store.insert("HOME_SLIDES", defaults);
    } catch {
      /* jangan blokir halaman Beranda apabila seed slide gagal */
    }
  })();
  return slidesSeededPromise;
}

export async function listHomeSlides(u: SessionUser): Promise<HomeSlideItem[]> {
  await ensureDefaultSlides();
  const store = await getStore();
  const rows = await store.list("HOME_SLIDES");
  return rows
    .filter((r) => u.role === "ADMIN_PAM" || r.status === "Aktif")
    .map((r) => ({
      slide_id: r.slide_id,
      title: r.title,
      badge: r.badge || "Informasi Arsip",
      description: r.description,
      cta_label: r.cta_label,
      cta_href: r.cta_href,
      has_image: !!r.image_ref,
      image_url: r.image_ref ? `/api/files/slide/${r.slide_id}?v=${encodeURIComponent(r.updated_at || "1")}` : "",
      sort_order: Number(r.sort_order || 99) || 99,
      status: r.status || "Aktif",
      updated_by: r.updated_by || "Admin GS",
      updated_at: r.updated_at,
      is_demo: r.is_demo === "1",
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.slide_id.localeCompare(b.slide_id));
}

export async function manageHomeSlide(u: SessionUser, fd: FormData) {
  if (u.role !== "ADMIN_PAM") {
    throw new HttpError(403, "Hanya Admin GS / PAM yang dapat mengelola foto & informasi slide Beranda.");
  }
  const store = await getStore();
  const action = String(fd.get("action") || "create").trim();

  if (action === "toggle") {
    const id = String(fd.get("id") || "").trim();
    const row = (await store.list("HOME_SLIDES")).find((r) => r.slide_id === id);
    if (!row) throw new HttpError(404, "Slide tidak ditemukan.");
    const next = String(fd.get("active")) === "1" ? "Aktif" : "Nonaktif";
    await store.update("HOME_SLIDES", id, { status: next, updated_at: nowIso(), updated_by: u.name });
    await logActivity(u, next === "Aktif" ? "AKTIFKAN_SLIDE_HOME" : "NONAKTIFKAN_SLIDE_HOME", "HOME_SLIDE", id, row.title);
    return { id, status: next };
  }

  if (action === "delete") {
    const id = String(fd.get("id") || "").trim();
    const row = (await store.list("HOME_SLIDES")).find((r) => r.slide_id === id);
    if (!row) throw new HttpError(404, "Slide tidak ditemukan.");
    await store.deleteWhere("HOME_SLIDES", (r) => r.slide_id === id);
    await logActivity(u, "HAPUS_SLIDE_HOME", "HOME_SLIDE", id, row.title);
    return { id };
  }

  const editId = action === "update" ? String(fd.get("id") || "").trim() : "";
  if (editId && !(await store.list("HOME_SLIDES")).some((r) => r.slide_id === editId)) {
    throw new HttpError(404, "Slide tidak ditemukan.");
  }

  const title = String(fd.get("title") || "").trim();
  if (title.length < 3) throw new HttpError(400, "Judul informasi slide wajib diisi (minimal 3 karakter).");
  const badge = String(fd.get("badge") || "Informasi Arsip").trim().slice(0, 40);
  const description = String(fd.get("description") || "").trim().slice(0, 600);
  if (description.length < 5) throw new HttpError(400, "Isi informasi slide wajib diisi.");
  const ctaLabel = String(fd.get("cta_label") || "").trim().slice(0, 40);
  const ctaHref = String(fd.get("cta_href") || "").trim().slice(0, 120);
  const sortOrder = String(Math.max(1, Number(fd.get("sort_order") || 1) || 1));

  const rawFile = fd.get("image");
  const imageFile = rawFile && typeof rawFile !== "string" && (rawFile as File).size > 0 ? (rawFile as File) : null;

  const patch: Partial<Row> = {
    title,
    badge,
    description,
    cta_label: ctaLabel,
    cta_href: ctaHref,
    sort_order: sortOrder,
    updated_by: u.name,
    updated_at: nowIso(),
    is_demo: "0",
  };

  if (imageFile) {
    const v = await validateUpload(imageFile, "image", "Foto Slide Beranda");
    // Simpan juga data-URI ringkas bila di bawah 34 KB sebagai cadangan instan di cloud, atau via saveFile standar
    let ref = await saveFile(v, "slides", {
      title: `Slide Beranda — ${title}`,
      entityId: editId || "SLIDE",
      uploadedBy: u.name,
    });
    if (ref.startsWith("local:") && v.buffer.length <= 34000) {
      ref = `data:${v.mime};base64,${v.buffer.toString("base64")}`;
    }
    Object.assign(patch, {
      image_ref: ref,
      file_name: v.name,
      mime: v.mime,
    });
  }

  if (editId) {
    await store.update("HOME_SLIDES", editId, patch);
    await logActivity(u, "UBAH_SLIDE_HOME", "HOME_SLIDE", editId, title);
    return { id: editId };
  }

  const all = await store.list("HOME_SLIDES");
  const newId = nextId("SLD", all, "slide_id");
  await store.insert("HOME_SLIDES", [{ slide_id: newId, status: "Aktif", image_ref: "", file_name: "", mime: "", ...patch } as Row]);
  await logActivity(u, "TAMBAH_SLIDE_HOME", "HOME_SLIDE", newId, title);
  return { id: newId };
}

/** Mengambil seluruh data Beranda: Sapaan personal, Slide, Progress pengajuan, Grafik 7 Region & Peringkat Top 3. */
export async function getHomePageData(u: SessionUser) {
  const [scopedDash, slides, store] = await Promise.all([
    getDashboard(u),
    listHomeSlides(u),
    getStore(),
  ]);

  const [regionsRaw, spbusRaw, subsRaw, docsRaw, usersRaw] = await Promise.all([
    store.list("REGIONS"),
    store.list("SPBUS"),
    store.list("SUBMISSIONS"),
    store.list("SUBMISSION_DOCUMENTS"),
    store.list("USERS"),
  ]);

  // Peta nama PIC tiap Region bila akun ADMIN_REGION sudah mengisi Nama Lengkap di Profil
  const regionPicMap = new Map<string, string>();
  for (const usr of usersRaw) {
    if (usr.role_id === "ADMIN_REGION" && usr.is_active === "1" && (usr.profile_name || "").trim()) {
      regionPicMap.set(usr.region_id, usr.profile_name.trim());
    }
  }

  // Sapaan: gunakan nama profil user yang login; bila belum diisi namun ia ADMIN_REGION yang namanya sudah tercatat, gunakan itu; jika belum ada tetap "Sahabat Arsip" (opsional)
  const greetingName =
    (u.profileName || "").trim() ||
    (u.role === "ADMIN_REGION" ? regionPicMap.get(u.regionId) || "" : "");

  // Hitung baris arsip per submission untuk skor apresiasi SPBU
  const arsipCountMap = new Map<string, number>();
  for (const d of docsRaw) {
    if (d.doc_type !== "EXCEL" || d.is_current !== "1") continue;
    try {
      const m = JSON.parse(d.meta || "{}");
      arsipCountMap.set(d.submission_id, Number(m.totalRows ?? m.rows ?? 0) || 0);
    } catch {
      /* abaikan */
    }
  }

  const activeRegions = regionsRaw
    .filter((r) => r.is_active === "1")
    .sort((a, b) => a.region_id.localeCompare(b.region_id, "id", { numeric: true }));

  const activeSpbus = spbusRaw.filter((s) => s.is_active === "1");
  const activeSpbuIds = new Set(activeSpbus.map((s) => s.spbu_id));
  const validSubs = subsRaw.filter((s) => activeSpbuIds.has(s.spbu_id));

  const regionStats: RegionRankItem[] = activeRegions.map((r) => {
    const rSpbus = activeSpbus.filter((s) => s.region_id === r.region_id);
    const rSubs = validSubs.filter((s) => s.region_id === r.region_id);
    const spbuSubmitted = new Set(rSubs.map((s) => s.spbu_id)).size;
    const approvedOrBeyond = rSubs.filter((s) =>
      [STATUS.APPROVED, STATUS.POOLED, STATUS.MEMOED].includes(s.status as any)
    ).length;
    const memoed = rSubs.filter((s) => s.status === STATUS.MEMOED).length;
    return {
      region_id: r.region_id,
      region_name: r.region_name,
      short_name: r.region_name.replace(/^Region\s+/i, "Reg "),
      pic_name: regionPicMap.get(r.region_id) || "",
      total_spbu: rSpbus.length,
      spbu_submitted: spbuSubmitted,
      participation_pct: rSpbus.length > 0 ? Math.round((spbuSubmitted / rSpbus.length) * 100) : 0,
      total_submissions: rSubs.length,
      approved_or_beyond: approvedOrBeyond,
      memoed,
      is_my_region: r.region_id === u.regionId,
    };
  });

  const topRegions = [...regionStats]
    .sort(
      (a, b) =>
        b.total_submissions - a.total_submissions ||
        b.memoed - a.memoed ||
        b.participation_pct - a.participation_pct
    )
    .slice(0, 3);

  const regNameMap = new Map(activeRegions.map((r) => [r.region_id, r.region_name]));
  const spbuStatsAll: SpbuRankItem[] = activeSpbus.map((s) => {
    const sSubs = validSubs.filter((x) => x.spbu_id === s.spbu_id);
    const memoed = sSubs.filter((x) => x.status === STATUS.MEMOED).length;
    const approvedOrBeyond = sSubs.filter((x) =>
      [STATUS.APPROVED, STATUS.POOLED, STATUS.MEMOED].includes(x.status as any)
    ).length;
    const arsipRows = sSubs.reduce((acc, x) => acc + (arsipCountMap.get(x.submission_id) || 0), 0);
    return {
      spbu_id: s.spbu_id,
      spbu_code: s.spbu_code,
      spbu_name: s.name,
      city: s.city || s.province || "",
      region_id: s.region_id,
      region_name: regNameMap.get(s.region_id) || s.region_id,
      total_submissions: sSubs.length,
      memoed,
      approved_or_beyond: approvedOrBeyond,
      arsip_rows: arsipRows,
      is_my_spbu: s.spbu_id === u.spbuId,
    };
  });

  const sortedSpbus = [...spbuStatsAll].sort(
    (a, b) =>
      b.total_submissions - a.total_submissions ||
      b.memoed - a.memoed ||
      b.approved_or_beyond - a.approved_or_beyond ||
      b.arsip_rows - a.arsip_rows
  );

  const topSpbus = sortedSpbus.filter((s) => s.total_submissions > 0).slice(0, 3);
  const mySpbuRankIndex = u.role === "ADMIN_SPBU" ? sortedSpbus.findIndex((s) => s.spbu_id === u.spbuId) : -1;
  const myRegionRankIndex =
    u.role !== "ADMIN_PAM"
      ? [...regionStats]
          .sort((a, b) => b.total_submissions - a.total_submissions || b.memoed - a.memoed)
          .findIndex((r) => r.region_id === u.regionId)
      : -1;

  // Nama region user (khusus PIC Region)
  const userRegion = activeRegions.find((r) => r.region_id === u.regionId);
  const userRegionName = userRegion ? userRegion.region_name : (u.regionId || "");

  // KPI per region (untuk filter 7 Region di Beranda Admin PAM)
  const regionKpis: Record<
    string,
    {
      region_id: string;
      region_name: string;
      total: number;
      review: number;
      revision: number;
      approved: number;
      pooled: number;
      memoed: number;
      approvedOrBeyond: number;
      totalSpbu: number;
      spbuSubmitted: number;
    }
  > = {};

  for (const r of activeRegions) {
    const rSpbus = activeSpbus.filter((s) => s.region_id === r.region_id);
    const rSubs = validSubs.filter((s) => s.region_id === r.region_id);
    const review = rSubs.filter((s) => s.status === STATUS.REVIEW).length;
    const revision = rSubs.filter((s) => s.status === STATUS.REVISION).length;
    const approved = rSubs.filter((s) => s.status === STATUS.APPROVED).length;
    const pooled = rSubs.filter((s) => s.status === STATUS.POOLED).length;
    const memoed = rSubs.filter((s) => s.status === STATUS.MEMOED).length;
    const spbuSubmitted = new Set(rSubs.map((s) => s.spbu_id)).size;
    regionKpis[r.region_id] = {
      region_id: r.region_id,
      region_name: r.region_name,
      total: rSubs.length,
      review,
      revision,
      approved,
      pooled,
      memoed,
      approvedOrBeyond: approved + pooled + memoed,
      totalSpbu: rSpbus.length,
      spbuSubmitted,
    };
  }

  // Ringkasan nasional untuk opsi "Semua Region (Nasional)" di PAM
  regionKpis["ALL"] = {
    region_id: "ALL",
    region_name: "Semua Region (Nasional)",
    total: validSubs.length,
    review: validSubs.filter((s) => s.status === STATUS.REVIEW).length,
    revision: validSubs.filter((s) => s.status === STATUS.REVISION).length,
    approved: validSubs.filter((s) => s.status === STATUS.APPROVED).length,
    pooled: validSubs.filter((s) => s.status === STATUS.POOLED).length,
    memoed: validSubs.filter((s) => s.status === STATUS.MEMOED).length,
    approvedOrBeyond: validSubs.filter((s) =>
      [STATUS.APPROVED, STATUS.POOLED, STATUS.MEMOED].includes(s.status as any)
    ).length,
    totalSpbu: activeSpbus.length,
    spbuSubmitted: new Set(validSubs.map((s) => s.spbu_id)).size,
  };

  const regionsSummary = activeRegions.map((r) => ({
    region_id: r.region_id,
    region_name: r.region_name,
    short_name: r.region_name.replace(/^Region\s+/i, "Reg "),
  }));

  return {
    greetingName,
    userRegionName,
    slides,
    kpi: scopedDash.kpi,
    scope: scopedDash.scope,
    regionStats,
    nationalTotalSubmissions: validSubs.length,
    topRegions,
    topSpbus,
    mySpbuRank: mySpbuRankIndex >= 0 ? mySpbuRankIndex + 1 : null,
    myRegionRank: myRegionRankIndex >= 0 ? myRegionRankIndex + 1 : null,
    regions: regionsSummary,
    regionKpis,
  };
}
