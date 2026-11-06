import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { assertScope } from "@/lib/services/core";
import { canAccessIbosRow } from "@/lib/services/ibos";

/**
 * Semua file disajikan lewat server setelah pemeriksaan hak akses; tautan Drive tidak pernah dibagikan ke browser.
 * ?download=1 -> unduh; ?preview=1 -> pratinjau Excel (JSON, 200 baris pertama).
 */
export async function GET(req: Request, { params }: { params: { kind: string; id: string } }) {
  return handle(async () => {
    const u = await requireUser();
    const store = await getStore();
    let ref = "", name = "", mime = "", docMetaRaw = "", isDemoRecord = false;
    if (params.kind === "doc" || params.kind === "photo") {
      const table = params.kind === "doc" ? "SUBMISSION_DOCUMENTS" : "SUBMISSION_PHOTOS";
      const key = params.kind === "doc" ? "doc_id" : "photo_id";
      const f = (await store.list(table)).find((r) => r[key] === params.id);
      if (!f) throw new HttpError(404, "File tidak ditemukan.");
      const sub = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === f.submission_id);
      if (!sub) throw new HttpError(404, "Pengajuan tidak ditemukan.");
      assertScope(u, sub.region_id, sub.spbu_id);
      ({ storage_ref: ref, file_name: name, mime } = f);
      docMetaRaw = f.meta || "";
    } else if (params.kind === "ibos") {
      const f = (await store.list("IBOS_EXTRACTS")).find((r) => r.extract_id === params.id);
      if (!f) throw new HttpError(404, "Data tarikan i-BOS tidak ditemukan.");
      if (!canAccessIbosRow(u, f)) {
        throw new HttpError(403, "Anda tidak memiliki akses ke berkas Data Tarikan i-BOS ini.");
      }
      ({ storage_ref: ref, file_name: name, mime } = f);
      docMetaRaw = f.meta || "";
      isDemoRecord = f.is_demo === "1";
    } else if (params.kind === "template" || params.kind === "knowledge") {
      const table = params.kind === "template" ? "TEMPLATES" : "KNOWLEDGE_DOCUMENTS";
      const key = params.kind === "template" ? "template_id" : "doc_id";
      const f = (await store.list(table)).find((r) => r[key] === params.id);
      if (!f || !f.storage_ref) throw new HttpError(404, "File belum tersedia.");
      if (u.role !== "ADMIN_PAM" && params.kind === "template" && f.status !== "Aktif") throw new HttpError(404, "Template tidak aktif.");
      ({ storage_ref: ref, file_name: name, mime } = f);
    } else if (params.kind === "index") {
      if (u.role !== "ADMIN_PAM") throw new HttpError(403, "Hanya Admin PAM yang dapat mengakses indeks berkas.");
      const f = (await store.list("FILE_INDEX")).find((r) => r.file_id === params.id);
      if (!f || !f.storage_ref) throw new HttpError(404, "File tidak ditemukan.");
      ref = f.storage_ref; name = f.file_name; mime = f.mime_type;
    } else throw new HttpError(404, "Jenis file tidak dikenal.");

    let parsedMeta: any = null;
    if (docMetaRaw) {
      try { parsedMeta = JSON.parse(docMetaRaw); } catch { parsedMeta = null; }
    }

    let buf: Buffer | null = null;
    const preferSynthesizedDemoIbos =
      params.kind === "ibos" && isDemoRecord && parsedMeta?.headers && parsedMeta?.previewRows;

    if (!preferSynthesizedDemoIbos && ref) {
      try {
        buf = await readFile(ref);
      } catch (e) {
        if (!parsedMeta?.headers || !parsedMeta?.previewRows) throw e;
      }
    }
    if (!buf && parsedMeta?.headers && parsedMeta?.previewRows) {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(parsedMeta.sheet || "Data Tarikan i-BOS");
      ws.addRow(parsedMeta.headers).font = { bold: true };
      for (const r of parsedMeta.previewRows) ws.addRow(r);
      ws.columns.forEach((c) => (c.width = 24));
      buf = Buffer.from(await wb.xlsx.writeBuffer());
    }
    if (!buf) throw new HttpError(404, "Berkas fisik tidak ditemukan.");

    const url = new URL(req.url);
    if (url.searchParams.get("preview") === "1") {
      if (!name.toLowerCase().endsWith(".xlsx")) throw new HttpError(400, "Pratinjau tabel hanya untuk Excel.");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.worksheets[0];
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row, n) => {
        if (n > 200) return;
        const vals = (row.values as any[]).slice(1).map((v) => (v && typeof v === "object" ? (v.text ?? v.result ?? "") : v ?? "").toString());
        rows.push(vals);
      });
      return NextResponse.json({ sheet: ws.name, rows, totalRows: ws.rowCount });
    }
    const inlineOk = mime === "application/pdf" || mime.startsWith("image/");
    const download = url.searchParams.get("download") === "1" || !inlineOk;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime || "application/octet-stream",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(name)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'self'",
      },
    });
  });
}
