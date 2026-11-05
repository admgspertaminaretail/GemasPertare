import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { assertScope } from "@/lib/services/core";

/**
 * Semua file disajikan lewat server setelah pemeriksaan hak akses; tautan Drive tidak pernah dibagikan ke browser.
 * ?download=1 -> unduh; ?preview=1 -> pratinjau Excel (JSON, 20 baris pertama).
 */
export async function GET(req: Request, { params }: { params: { kind: string; id: string } }) {
  return handle(async () => {
    const u = await requireUser();
    const store = await getStore();
    let ref = "", name = "", mime = "";
    if (params.kind === "doc" || params.kind === "photo") {
      const table = params.kind === "doc" ? "SUBMISSION_DOCUMENTS" : "SUBMISSION_PHOTOS";
      const key = params.kind === "doc" ? "doc_id" : "photo_id";
      const f = (await store.list(table)).find((r) => r[key] === params.id);
      if (!f) throw new HttpError(404, "File tidak ditemukan.");
      const sub = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === f.submission_id);
      if (!sub) throw new HttpError(404, "Pengajuan tidak ditemukan.");
      assertScope(u, sub.region_id, sub.spbu_id);
      ({ storage_ref: ref, file_name: name, mime } = f);
    } else if (params.kind === "template" || params.kind === "knowledge") {
      const table = params.kind === "template" ? "TEMPLATES" : "KNOWLEDGE_DOCUMENTS";
      const key = params.kind === "template" ? "template_id" : "doc_id";
      const f = (await store.list(table)).find((r) => r[key] === params.id);
      if (!f || !f.storage_ref) throw new HttpError(404, "File belum tersedia.");
      if (u.role !== "ADMIN_PAM" && params.kind === "template" && f.status !== "Aktif") throw new HttpError(404, "Template tidak aktif.");
      ({ storage_ref: ref, file_name: name, mime } = f);
    } else throw new HttpError(404, "Jenis file tidak dikenal.");

    const buf = await readFile(ref);
    const url = new URL(req.url);
    if (url.searchParams.get("preview") === "1") {
      if (!name.toLowerCase().endsWith(".xlsx")) throw new HttpError(400, "Pratinjau tabel hanya untuk Excel.");
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.worksheets[0];
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row, n) => {
        if (n > 20) return;
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
