import { getStore } from "../db";
import { HttpError, SessionUser } from "../auth";
import { Row } from "../schema";
import { saveFile, validateUpload } from "../storage";
import { logActivity, nextId, nowIso, today } from "./core";
import { packExcelMeta, parseExcelStructured } from "./submissions";

export type IbosTargetScope = "ALL" | "REGION" | "SPBU";

export interface IbosExtractItem {
  extract_id: string;
  period: string;
  title: string;
  target_scope: IbosTargetScope;
  target_label: string;
  region_id: string;
  region_name: string;
  spbu_id: string;
  spbu_code: string;
  spbu_name: string;
  description: string;
  status: string;
  file_name: string;
  mime: string;
  size: string;
  total_rows: number;
  sheet: string;
  headers: string[];
  rows: string[][];
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  is_demo: boolean;
}

const DEMO_IBOS_HEADERS = [
  "No",
  "Kode Arsip i-BOS",
  "Nama Dokumen / Transaksi",
  "Tanggal Dokumen",
  "Unit SPBU",
  "Masa Retensi (JRDP)",
  "Keterangan",
];

let demoIbosReadyPromise: Promise<void> | null = null;

/** Cek apakah user berhak melihat / mengunduh baris Data Arsip Tarikan i-BOS. */
export function canAccessIbosRow(u: SessionUser, row: Row): boolean {
  if (u.role === "ADMIN_PAM") return true;
  if (row.status !== "Aktif") return false;
  const scope = (row.target_scope || "ALL").toUpperCase();
  if (scope === "ALL") return true;
  if (scope === "REGION") return row.region_id === u.regionId;
  if (scope === "SPBU") {
    if (u.role === "ADMIN_SPBU") return row.spbu_id === u.spbuId;
    if (u.role === "ADMIN_REGION") return row.region_id === u.regionId;
  }
  return false;
}

async function ensureIbosInitialized() {
  if (demoIbosReadyPromise) return demoIbosReadyPromise;
  demoIbosReadyPromise = (async () => {
    try {
      const store = await getStore();
      // Bersihkan sisa dokumen TARIKAN_DATA lama (jika sempat dibuat saat revisi sebelumnya)
      const oldDocs = await store.list("SUBMISSION_DOCUMENTS");
      if (oldDocs.some((d) => d.doc_type === "TARIKAN_DATA" || d.doc_id.startsWith("DOC-TRK"))) {
        await store.deleteWhere(
          "SUBMISSION_DOCUMENTS",
          (d) => d.doc_type === "TARIKAN_DATA" || d.doc_id.startsWith("DOC-TRK")
        );
      }

      if (process.env.DEMO_MODE === "false") return;
      const existing = await store.list("IBOS_EXTRACTS");
      if (existing.length > 0) return;

      const [regions, spbus] = await Promise.all([store.list("REGIONS"), store.list("SPBUS")]);
      const sampleRegion = regions.find((r) => r.region_id === "REG-3") || regions[0];
      const spbuCodes = spbus.slice(0, 6).map((s) => `SPBU ${s.spbu_code}`);

      const makeSampleRows = (period: string, unitLabel?: string): string[][] => {
        const yr = Number(period.slice(0, 4)) - 5;
        const catalog: [string, string, string, string][] = [
          ["IBOS-BBM-01", "Rekap Penjualan BBM Harian (Shift 1–3)", "5 Tahun", "Retensi aktif & inaktif terpenuhi — siap disaring ke Daftar Arsip"],
          ["IBOS-ATG-02", "Laporan Rekonsiliasi Stok Tangki Pendam & ATG", "5 Tahun", "Data tarikan sistem i-BOS terverifikasi"],
          ["IBOS-SET-03", "Bukti Setoran Penjualan Tunai, QRIS & EDC", "5 Tahun", "Telah diaudit keuangan periodik"],
          ["IBOS-LO-04", "Arsip Loading Order (LO) & Surat Pengantar BBM", "5 Tahun", "Cocokkan fisik berkas di gudang arsip SPBU"],
          ["IBOS-LHP-05", "Laporan Harian Pengawas (LHP) Operasional SPBU", "5 Tahun", "Siap diusulkan musnah sesuai JRDP"],
          ["IBOS-NFR-06", "Rekap Transaksi Non-Fuel Retail & Pelumas", "5 Tahun", "Periksa kelengkapan berita acara fisik"],
        ];
        return catalog.map((c, idx) => [
          String(idx + 1),
          `${c[0]}/${yr}/${String(idx + 1).padStart(3, "0")}`,
          c[1],
          `${yr}-${period.slice(5, 7)}-${String((idx * 4 + 3) % 28 + 1).padStart(2, "0")}`,
          unitLabel || spbuCodes[idx % Math.max(1, spbuCodes.length)] || "Seluruh SPBU COCO",
          c[2],
          c[3],
        ]);
      };

      const buildDemoRow = (
        id: string,
        period: string,
        title: string,
        scope: IbosTargetScope,
        regionId: string,
        description: string,
        uploadedAt: string,
        unitLabel?: string
      ): Row => {
        const rows = makeSampleRows(period, unitLabel);
        const meta = JSON.stringify({
          period,
          rows: rows.length,
          totalRows: rows.length,
          sheet: `Tarikan i-BOS ${period}`,
          headers: DEMO_IBOS_HEADERS,
          previewRows: rows,
        });
        return {
          extract_id: id,
          period,
          title,
          target_scope: scope,
          region_id: regionId,
          spbu_id: "",
          description,
          status: "Aktif",
          file_name: `Data_Arsip_Tarikan_iBOS_${scope === "REGION" ? regionId + "_" : "Nasional_"}${period}.xlsx`,
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: "18432",
          storage_ref: "local:templates/Template_Data_Tarikan_iBOS.xlsx",
          total_rows: String(rows.length),
          meta,
          uploaded_by: "USR-001",
          uploaded_by_name: "Admin GS / PAM (Demo)",
          uploaded_at: uploadedAt,
          is_demo: "1",
        };
      };

      const seedRows: Row[] = [
        buildDemoRow(
          "IBOS-0001",
          "2026-11",
          "Data Arsip Tarikan i-BOS Nasional — November 2026",
          "ALL",
          "",
          "Data tarikan arsip bulanan dari sistem i-BOS periode November 2026 untuk seluruh SPBU. Silakan unduh sebagai acuan pengisian Template Daftar Arsip Usul Musnah.",
          "2026-11-02T08:30:00.000Z"
        ),
        ...(sampleRegion
          ? [
              buildDemoRow(
                "IBOS-0002",
                "2026-11",
                `Data Arsip Tarikan i-BOS ${sampleRegion.region_name} — November 2026`,
                "REGION",
                sampleRegion.region_id,
                `Lampiran khusus tarikan data arsip i-BOS wilayah ${sampleRegion.region_name} periode November 2026.`,
                "2026-11-03T09:15:00.000Z",
                `SPBU Area ${sampleRegion.region_name}`
              ),
            ]
          : []),
        buildDemoRow(
          "IBOS-0003",
          "2026-10",
          "Data Arsip Tarikan i-BOS Nasional — Oktober 2026",
          "ALL",
          "",
          "Data tarikan arsip bulanan dari sistem i-BOS periode Oktober 2026 untuk seluruh SPBU.",
          "2026-10-03T08:45:00.000Z"
        ),
        buildDemoRow(
          "IBOS-0004",
          "2026-09",
          "Data Arsip Tarikan i-BOS Nasional — September 2026",
          "ALL",
          "",
          "Data tarikan arsip bulanan dari sistem i-BOS periode September 2026 untuk seluruh SPBU.",
          "2026-09-04T09:00:00.000Z"
        ),
      ];

      await store.insert("IBOS_EXTRACTS", seedRows);
    } catch {
      /* jangan blokir pembacaan halaman apabila inisialisasi demo gagal */
    }
  })();
  return demoIbosReadyPromise;
}

/** Daftar Data Arsip Tarikan i-BOS sesuai hak akses pengguna. */
export async function listIbosExtracts(u: SessionUser) {
  await ensureIbosInitialized();
  const store = await getStore();
  const [raw, regions, spbus, templates] = await Promise.all([
    store.list("IBOS_EXTRACTS"),
    store.list("REGIONS"),
    store.list("SPBUS"),
    store.list("TEMPLATES"),
  ]);

  const regMap = new Map(regions.map((r) => [r.region_id, r.region_name]));
  const spMap = new Map(spbus.map((s) => [s.spbu_id, s]));

  const items: IbosExtractItem[] = raw
    .filter((r) => canAccessIbosRow(u, r))
    .map((r) => {
      let m: any = {};
      try {
        m = r.meta ? JSON.parse(r.meta) : {};
      } catch {
        m = {};
      }
      const scope = ((r.target_scope || "ALL").toUpperCase() as IbosTargetScope);
      const sp = r.spbu_id ? spMap.get(r.spbu_id) : undefined;
      const regName = r.region_id ? regMap.get(r.region_id) || r.region_id : "";
      const targetLabel =
        scope === "SPBU" && sp
          ? `SPBU ${sp.spbu_code} — ${sp.name}`
          : scope === "REGION" && regName
            ? regName
            : "Seluruh SPBU (Nasional)";

      const headers: string[] = Array.isArray(m.headers) ? m.headers : [];
      const rows: string[][] = Array.isArray(m.previewRows) ? m.previewRows : [];
      const totalRows = Number(r.total_rows || m.totalRows || m.rows || rows.length) || 0;

      return {
        extract_id: r.extract_id,
        period: r.period || (r.uploaded_at ? r.uploaded_at.slice(0, 7) : today().slice(0, 7)),
        title: r.title,
        target_scope: scope,
        target_label: targetLabel,
        region_id: r.region_id,
        region_name: regName,
        spbu_id: r.spbu_id,
        spbu_code: sp?.spbu_code || "",
        spbu_name: sp?.name || "",
        description: r.description,
        status: r.status || "Aktif",
        file_name: r.file_name,
        mime: r.mime,
        size: r.size,
        total_rows: totalRows,
        sheet: m.sheet || "Data i-BOS",
        headers,
        rows,
        uploaded_by: r.uploaded_by,
        uploaded_by_name: r.uploaded_by_name || "Admin GS",
        uploaded_at: r.uploaded_at,
        is_demo: r.is_demo === "1",
      };
    })
    .sort((a, b) => b.period.localeCompare(a.period) || b.uploaded_at.localeCompare(a.uploaded_at));

  const daftarTpl =
    templates.find((t) => t.status === "Aktif" && t.category === "Daftar Arsip") ||
    templates.find((t) => t.status === "Aktif" && /daftar arsip/i.test(t.name)) ||
    null;

  return {
    items,
    regions: regions
      .filter((r) => r.is_active === "1")
      .map((r) => ({ region_id: r.region_id, region_name: r.region_name })),
    spbus:
      u.role === "ADMIN_PAM"
        ? spbus
            .filter((s) => s.is_active === "1")
            .map((s) => ({
              spbu_id: s.spbu_id,
              spbu_code: s.spbu_code,
              name: s.name,
              region_id: s.region_id,
              region_name: regMap.get(s.region_id) || s.region_id,
            }))
            .sort((a, b) => a.region_id.localeCompare(b.region_id) || a.spbu_code.localeCompare(b.spbu_code))
        : [],
    daftarArsipTemplate: daftarTpl
      ? { id: daftarTpl.template_id, name: daftarTpl.name, version: daftarTpl.version }
      : null,
  };
}

/** Kelola Data Arsip Tarikan i-BOS — khusus Admin GS / PAM (ADMIN_PAM). */
export async function manageIbosExtract(u: SessionUser, fd: FormData) {
  if (u.role !== "ADMIN_PAM") {
    throw new HttpError(403, "Hanya Admin GS / PAM yang dapat mengunggah atau mengubah Data Arsip Tarikan i-BOS.");
  }
  const store = await getStore();
  const action = String(fd.get("action") || "create").trim();

  if (action === "toggle") {
    const id = String(fd.get("id") || "").trim();
    const row = (await store.list("IBOS_EXTRACTS")).find((r) => r.extract_id === id);
    if (!row) throw new HttpError(404, "Data tarikan i-BOS tidak ditemukan.");
    const nextStatus = String(fd.get("active")) === "1" ? "Aktif" : "Nonaktif";
    await store.update("IBOS_EXTRACTS", id, { status: nextStatus });
    await logActivity(u, nextStatus === "Aktif" ? "AKTIFKAN_TARIKAN_IBOS" : "NONAKTIFKAN_TARIKAN_IBOS", "IBOS_EXTRACT", id, row.title);
    return { id, status: nextStatus };
  }

  if (action === "delete") {
    const id = String(fd.get("id") || "").trim();
    const row = (await store.list("IBOS_EXTRACTS")).find((r) => r.extract_id === id);
    if (!row) throw new HttpError(404, "Data tarikan i-BOS tidak ditemukan.");
    await store.deleteWhere("IBOS_EXTRACTS", (r) => r.extract_id === id);
    await logActivity(u, "HAPUS_TARIKAN_IBOS", "IBOS_EXTRACT", id, `${row.title} (${row.period})`);
    return { id };
  }

  const editId = action === "update" ? String(fd.get("id") || "").trim() : "";
  const existing = editId ? (await store.list("IBOS_EXTRACTS")).find((r) => r.extract_id === editId) : undefined;
  if (editId && !existing) throw new HttpError(404, "Data tarikan i-BOS tidak ditemukan.");

  const period = String(fd.get("period") || today().slice(0, 7)).trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new HttpError(400, "Periode bulan wajib berformat YYYY-MM.");
  }
  const title = String(fd.get("title") || "").trim();
  if (title.length < 3) throw new HttpError(400, "Judul data tarikan wajib diisi (minimal 3 karakter).");

  const rawScope = String(fd.get("target_scope") || "ALL").trim().toUpperCase();
  if (!["ALL", "REGION", "SPBU"].includes(rawScope)) {
    throw new HttpError(400, "Target penerima tidak valid.");
  }
  const targetScope = rawScope as IbosTargetScope;

  let regionId = "";
  let spbuId = "";
  if (targetScope === "REGION") {
    regionId = String(fd.get("region_id") || "").trim();
    const reg = (await store.list("REGIONS")).find((r) => r.region_id === regionId && r.is_active === "1");
    if (!reg) throw new HttpError(400, "Pilih Region tujuan terlebih dahulu.");
  } else if (targetScope === "SPBU") {
    spbuId = String(fd.get("spbu_id") || "").trim();
    const sp = (await store.list("SPBUS")).find((s) => s.spbu_id === spbuId && s.is_active === "1");
    if (!sp) throw new HttpError(400, "Pilih SPBU tujuan terlebih dahulu.");
    regionId = sp.region_id;
  }

  const description = String(fd.get("description") || "").trim().slice(0, 600);
  const rawFile = fd.get("file");
  const file = rawFile && typeof rawFile !== "string" && (rawFile as File).size > 0 ? (rawFile as File) : null;
  if (!editId && !file) {
    throw new HttpError(400, "File Data Arsip Tarikan i-BOS (.xlsx / .pdf) wajib diunggah.");
  }

  const patch: Partial<Row> = {
    period,
    title,
    target_scope: targetScope,
    region_id: regionId,
    spbu_id: spbuId,
    description,
    uploaded_by: u.userId,
    uploaded_by_name: u.name,
    uploaded_at: nowIso(),
    is_demo: "0",
  };

  if (file) {
    const validated = await validateUpload(file, "document", "File Data Arsip Tarikan i-BOS");
    let meta = "";
    let totalRows = "0";
    if (validated.name.toLowerCase().endsWith(".xlsx")) {
      try {
        const parsed = await parseExcelStructured(validated, "File Data Arsip Tarikan i-BOS");
        meta = packExcelMeta(parsed, { period });
        totalRows = String(parsed.totalRows);
      } catch (e: any) {
        throw new HttpError(400, e.message || "File Excel tidak valid.");
      }
    }
    const targetId = editId || "IBOS";
    const ref = await saveFile(validated, `ibos/${period}`, {
      title: `${title} (${period})`,
      entityId: targetId,
      uploadedBy: u.name,
    });
    Object.assign(patch, {
      file_name: validated.name,
      mime: validated.mime,
      size: String(validated.size),
      storage_ref: ref,
      total_rows: totalRows,
      meta,
    });
  }

  if (editId) {
    await store.update("IBOS_EXTRACTS", editId, patch);
    await logActivity(u, "UBAH_TARIKAN_IBOS", "IBOS_EXTRACT", editId, `${title} (${period})`);
    return { id: editId };
  }

  const all = await store.list("IBOS_EXTRACTS");
  const newId = nextId("IBOS", all, "extract_id");
  await store.insert("IBOS_EXTRACTS", [
    {
      extract_id: newId,
      status: "Aktif",
      ...patch,
    } as Row,
  ]);
  await logActivity(u, "UPLOAD_TARIKAN_IBOS", "IBOS_EXTRACT", newId, `${title} (${period}) — Target: ${targetScope}`);
  return { id: newId };
}
