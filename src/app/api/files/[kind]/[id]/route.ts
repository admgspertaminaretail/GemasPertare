import zlib from "zlib";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { readFile } from "@/lib/storage";
import { buildTemplateAssets } from "@/lib/seed";
import { assertScope } from "@/lib/services/core";
import { canAccessIbosRow } from "@/lib/services/ibos";

const safeWinAnsi = (s: string) =>
  String(s || "")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");

function wrapLine(text: string, maxChars: number): string[] {
  const words = safeWinAnsi(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    if ((cur + " " + words[i]).length <= maxChars) cur += " " + words[i];
    else {
      lines.push(cur);
      cur = words[i];
    }
  }
  lines.push(cur);
  return lines;
}

const KNOWLEDGE_HIGHLIGHTS: Record<string, string[]> = {
  Pedoman: [
    "1. Seluruh dokumen operasional SPBU & Region wajib diklasifikasikan sesuai kode klasifikasi resmi.",
    "2. Penyimpanan arsip aktif dilakukan di unit kerja dengan penataan rapi, aman dari lembap dan bahaya api.",
    "3. Pemusnahan arsip DILARANG dilakukan secara mandiri tanpa prosedur resmi dan persetujuan berjenjang.",
    "4. Setiap pengajuan usul musnah wajib dilengkapi Daftar Arsip Usul Musnah (Excel), PDF Arsip Usul Musnah, dan foto fisik.",
  ],
  TKI: [
    "1. TKI mengatur langkah kerja terstandar mulai dari identifikasi arsip inaktif hingga serah terima/pemusnahan.",
    "2. Admin SPBU memeriksa data arsip per bulan, memilah dokumen yang habis masa retensinya, lalu mengunggah ke GEMAS.",
    "3. PIC Region melakukan verifikasi kelengkapan daftar arsip, kesesuaian JRDP, serta kejelasan foto kondisi fisik.",
    "4. Pengajuan yang disetujui digabungkan dalam Pooling Regional dan diteruskan melalui MEMO resmi ke fungsi PAM/GS.",
  ],
  "Jadwal Retensi (JRDP)": [
    "1. JRDP menjadi acuan tunggal penentuan masa simpan aktif dan masa simpan inaktif setiap jenis arsip perusahaan.",
    "2. Hanya arsip yang telah melewati total masa retensi (aktif + inaktif) dan tidak bernilai guna hukum/audit yang boleh diusulkan musnah.",
    "3. Dokumen keuangan, perpajakan, perizinan, dan berita acara wajib dicek tahun terbitnya secara teliti sebelum diajukan.",
    "4. Apabila ragu terhadap kategori retensi suatu dokumen, konsultasikan ke Document Controller atau Tanya si GEMAS.",
  ],
  "Buku Saku": [
    "1. Panduan ringkas lapangan bagi tim SPBU dalam menata boks arsip, memberi label tahun/kode, dan menjaga kerapian gudang.",
    "2. Gunakan boks arsip standar, hindari menumpuk langsung di lantai, dan dokumentasikan kondisi ruang simpan secara berkala.",
    "3. Saat memotret fisik arsip untuk pengajuan GEMAS, pastikan label boks, tumpukan berkas, dan kondisi ruang terlihat jelas.",
  ],
  "Sprint (Surat Perintah)": [
    "1. Surat Perintah (Sprint) menjadi dasar penugasan resmi tim pengelolaan dan penertiban arsip di lingkungan PT Pertamina Retail.",
    "2. Seluruh unit SPBU dan Region diharapkan mendukung pelaksanaan pendataan, pemilahan, serta pengajuan usul musnah tepat waktu.",
    "3. Monitoring capaian pengajuan tiap Region dan SPBU dipantau secara transparan melalui Beranda GEMAS.",
  ],
  "Manual Book": [
    "1. Panduan teknis bagi Admin Unit terkait pengelolaan data transaksi & dokumen pada sistem i-BOS.",
    "2. Data tarikan arsip per bulan dari i-BOS disediakan oleh Admin GS dan dapat diunduh langsung pada pintasan Pengajuan.",
    "3. Gunakan data bulanan tersebut sebagai referensi awal saat menyusun Daftar Arsip Usul Musnah SPBU.",
  ],
};

async function buildKnowledgeSummaryPdf(f: Record<string, string>): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);

  // Header
  page.drawRectangle({ x: 0, y: 768, width: 595, height: 74, color: rgb(0.086, 0.231, 0.388) });
  page.drawRectangle({ x: 0, y: 763, width: 595, height: 5, color: rgb(0.412, 0.702, 0.271) });
  page.drawText("GEMAS - PUSAT INFORMASI ARSIP PT PERTAMINA RETAIL", {
    x: 40,
    y: 812,
    size: 11,
    font: bold,
    color: rgb(0.75, 0.88, 1),
  });
  page.drawText(safeWinAnsi(`Kategori: ${f.category || "Dokumen Kearsipan"}  |  Status: ${f.status || "Aktif"}`), {
    x: 40,
    y: 788,
    size: 10,
    font: reg,
    color: rgb(1, 1, 1),
  });

  // Title
  let y = 724;
  for (const line of wrapLine(f.title || "Dokumen Informasi Arsip", 52)) {
    page.drawText(line, { x: 40, y, size: 17, font: bold, color: rgb(0.086, 0.231, 0.388) });
    y -= 24;
  }

  // Metadata box
  y -= 8;
  page.drawRectangle({ x: 40, y: y - 48, width: 515, height: 56, color: rgb(0.94, 0.97, 1) });
  page.drawText(safeWinAnsi(`Pengelola: ${f.managed_by || "Admin PAM / GS"}`), {
    x: 54,
    y: y - 16,
    size: 10,
    font: bold,
    color: rgb(0, 0.424, 0.718),
  });
  page.drawText(safeWinAnsi(`Versi: ${f.version || "Ringkasan Digital GEMAS"}`), {
    x: 310,
    y: y - 16,
    size: 10,
    font: reg,
    color: rgb(0.25, 0.32, 0.4),
  });
  const descLines = wrapLine(f.description || "Ringkasan pedoman resmi pengelolaan dan pemusnahan arsip.", 78);
  page.drawText(descLines[0] || "", { x: 54, y: y - 34, size: 9.5, font: reg, color: rgb(0.25, 0.32, 0.4) });

  // Highlights
  y -= 84;
  page.drawText("Pokok-Pokok Informasi & Panduan Penting:", {
    x: 40,
    y,
    size: 12,
    font: bold,
    color: rgb(0.086, 0.231, 0.388),
  });
  y -= 22;

  const bullets = KNOWLEDGE_HIGHLIGHTS[f.category] || KNOWLEDGE_HIGHLIGHTS.Pedoman;
  for (const b of bullets) {
    for (const line of wrapLine(b, 76)) {
      page.drawText(line, { x: 46, y, size: 10.5, font: reg, color: rgb(0.18, 0.22, 0.28) });
      y -= 16;
    }
    y -= 6;
  }

  // Footer box
  page.drawRectangle({ x: 40, y: 60, width: 515, height: 54, color: rgb(0.99, 0.96, 0.9) });
  page.drawText("Catatan Pratinjau Langsung:", {
    x: 54,
    y: 94,
    size: 9.5,
    font: bold,
    color: rgb(0.65, 0.38, 0.05),
  });
  page.drawText(
    "Halaman ini dapat dibaca langsung tanpa perlu mengunduh berkas. Admin GS / PAM dapat",
    { x: 54, y: 79, size: 9, font: reg, color: rgb(0.45, 0.3, 0.1) }
  );
  page.drawText(
    "mengunggah/memperbarui berkas PDF resmi kapan saja melalui menu Pusat Informasi Arsip.",
    { x: 54, y: 67, size: 9, font: reg, color: rgb(0.45, 0.3, 0.1) }
  );

  return Buffer.from(await doc.save());
}

function extractDocxParagraphs(buf: Buffer): string[] {
  // Cari End of Central Directory (EOCD) signature 0x06054b50
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let pos = cdOffset;
  const end = Math.min(buf.length, cdOffset + cdSize);

  while (pos + 46 <= end) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const entryName = buf.slice(pos + 46, pos + 46 + nameLen).toString("utf8");
    pos += 46 + nameLen + extraLen + commentLen;

    if (entryName === "word/document.xml" && localOffset + 30 <= buf.length) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const comp = buf.slice(dataStart, dataStart + compSize);
      const xmlBuf = method === 8 ? zlib.inflateRawSync(comp) : method === 0 ? comp : null;
      if (!xmlBuf) return [];
      const xml = xmlBuf.toString("utf8");
      return xml
        .split(/<\/w:p>/)
        .map((p) =>
          (p.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g) || [])
            .map((t) => t.replace(/<[^>]+>/g, ""))
            .join("")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim()
        )
        .filter(Boolean);
    }
  }
  return [];
}

/**
 * Semua file disajikan lewat server setelah pemeriksaan hak akses; tautan Drive tidak pernah dibagikan ke browser.
 * ?download=1 -> unduh; ?preview=1 -> pratinjau Excel (JSON, 200 baris pertama) atau Word (.docx).
 */
export async function GET(req: Request, { params }: { params: { kind: string; id: string } }) {
  return handle(async () => {
    const u = await requireUser();
    const store = await getStore();
    let ref = "", name = "", mime = "", docMetaRaw = "", isDemoRecord = false;
    let buf: Buffer | null = null;
    let rowRecord: Record<string, string> | null = null;

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
      rowRecord = f;
    } else if (params.kind === "ibos") {
      const f = (await store.list("IBOS_EXTRACTS")).find((r) => r.extract_id === params.id);
      if (!f) throw new HttpError(404, "Data tarikan i-BOS tidak ditemukan.");
      if (!canAccessIbosRow(u, f)) {
        throw new HttpError(403, "Anda tidak memiliki akses ke berkas Data Tarikan i-BOS ini.");
      }
      ({ storage_ref: ref, file_name: name, mime } = f);
      docMetaRaw = f.meta || "";
      isDemoRecord = f.is_demo === "1";
      rowRecord = f;
    } else if (params.kind === "slide") {
      const f = (await store.list("HOME_SLIDES")).find((r) => r.slide_id === params.id);
      if (!f || !f.image_ref) throw new HttpError(404, "Gambar slide tidak ditemukan.");
      if (u.role !== "ADMIN_PAM" && f.status !== "Aktif") throw new HttpError(404, "Slide tidak aktif.");
      if (f.image_ref.startsWith("data:")) {
        const m = /^data:([^;]+);base64,(.+)$/.exec(f.image_ref);
        if (!m) throw new HttpError(400, "Format gambar slide tidak valid.");
        mime = m[1];
        buf = Buffer.from(m[2], "base64");
        name = f.file_name || `${f.slide_id}.jpg`;
      } else {
        ref = f.image_ref;
        name = f.file_name || `${f.slide_id}.jpg`;
        mime = f.mime || "image/jpeg";
      }
      rowRecord = f;
    } else if (params.kind === "template") {
      const f = (await store.list("TEMPLATES")).find((r) => r.template_id === params.id);
      if (!f) throw new HttpError(404, "Template tidak ditemukan.");
      if (u.role !== "ADMIN_PAM" && f.status !== "Aktif") throw new HttpError(404, "Template tidak aktif.");
      if (u.role === "ADMIN_SPBU" && f.category === "Form FUPA") {
        throw new HttpError(403, "Template ini tidak digunakan pada akun Admin SPBU.");
      }
      ({ storage_ref: ref, file_name: name, mime } = f);
      isDemoRecord = f.is_demo === "1";
      rowRecord = f;
    } else if (params.kind === "knowledge") {
      const f = (await store.list("KNOWLEDGE_DOCUMENTS")).find((r) => r.doc_id === params.id);
      if (!f) throw new HttpError(404, "Dokumen tidak ditemukan.");
      ref = f.storage_ref || "";
      name = f.file_name || `${(f.title || f.doc_id).replace(/[^\w.\- ()]/g, "_")}.pdf`;
      mime = f.mime || "application/pdf";
      rowRecord = f;
    } else if (params.kind === "index") {
      if (u.role !== "ADMIN_PAM") throw new HttpError(403, "Hanya Admin PAM yang dapat mengakses indeks berkas.");
      const f = (await store.list("FILE_INDEX")).find((r) => r.file_id === params.id);
      if (!f || !f.storage_ref) throw new HttpError(404, "File tidak ditemukan.");
      ref = f.storage_ref; name = f.file_name; mime = f.mime_type;
      rowRecord = f;
    } else throw new HttpError(404, "Jenis file tidak dikenal.");

    let parsedMeta: any = null;
    if (docMetaRaw) {
      try { parsedMeta = JSON.parse(docMetaRaw); } catch { parsedMeta = null; }
    }

    const preferSynthesizedDemoIbos =
      params.kind === "ibos" && isDemoRecord && parsedMeta?.headers && parsedMeta?.previewRows;

    if (!buf && !preferSynthesizedDemoIbos && ref) {
      try {
        buf = await readFile(ref);
      } catch (e) {
        if (
          !(parsedMeta?.headers && parsedMeta?.previewRows) &&
          !(params.kind === "template" && isDemoRecord) &&
          params.kind !== "knowledge"
        ) {
          throw e;
        }
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
    if (!buf && params.kind === "template" && isDemoRecord && rowRecord) {
      const assets = await buildTemplateAssets();
      if (rowRecord.category === "Daftar Arsip") buf = assets.list;
      else if (rowRecord.category === "Form FUPA") buf = assets.fupa;
      else buf = assets.ibos;
    }
    if (!buf && params.kind === "knowledge" && rowRecord) {
      buf = await buildKnowledgeSummaryPdf(rowRecord);
      mime = "application/pdf";
      if (!name.toLowerCase().endsWith(".pdf")) {
        name = `${(rowRecord.title || rowRecord.doc_id).replace(/[^\w.\- ()]/g, "_")}.pdf`;
      }
    }
    if (!buf) throw new HttpError(404, "Berkas fisik tidak ditemukan.");

    const url = new URL(req.url);
    if (url.searchParams.get("preview") === "1") {
      const lower = name.toLowerCase();
      if (lower.endsWith(".xlsx")) {
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf as any);
        const ws = wb.worksheets[0];
        const rows: string[][] = [];
        ws.eachRow({ includeEmpty: false }, (row, n) => {
          if (n > 200) return;
          const vals = (row.values as any[]).slice(1).map((v) => (v && typeof v === "object" ? (v.text ?? v.result ?? "") : v ?? "").toString());
          rows.push(vals);
        });
        return NextResponse.json({ kind: "xlsx", sheet: ws.name, rows, totalRows: ws.rowCount });
      }
      if (lower.endsWith(".docx")) {
        const paragraphs = extractDocxParagraphs(buf);
        return NextResponse.json({ kind: "docx", paragraphs });
      }
      throw new HttpError(400, "Pratinjau teks/tabel hanya untuk Excel (.xlsx) atau Word (.docx).");
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
