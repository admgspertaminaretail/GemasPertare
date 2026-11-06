import fs from "fs";
import path from "path";
import zlib from "zlib";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Row, TABLES, TableName } from "./schema";
import { DEMO_PASSWORD, FORWARD, STATUS, StatusValue } from "./constants";
import { UPLOAD_DIR } from "./store";
import spbuMaster from "../../data/spbu_master.json";

type Db = Record<TableName, Row[]>;
const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8" };

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n: number, w = 3) => String(n).padStart(w, "0");

/* --------------------------- file placeholder --------------------------- */
function crc32(buf: Buffer) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w: number, h: number, px: (x: number, y: number) => [number, number, number]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function pdfPlaceholder(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: rgb(0, 0.42, 0.72) });
  page.drawText("GEMAS - DOKUMEN CONTOH (DATA DEMO)", { x: 40, y: 805, size: 14, font, color: rgb(1, 1, 1) });
  page.drawText(title, { x: 40, y: 740, size: 18, font, color: rgb(0.09, 0.23, 0.39) });
  lines.forEach((l, i) => page.drawText(l, { x: 40, y: 700 - i * 20, size: 11, font: reg, color: rgb(0.2, 0.2, 0.2) }));
  return Buffer.from(await doc.save());
}

async function xlsxBuffer(sheetName: string, header: string[], rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(header).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = 22));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function write(rel: string, buf: Buffer) {
  const full = path.join(UPLOAD_DIR, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  return `local:${rel}`;
}

export const ARCHIVE_LIST_HEADER = [
  "No", "Kode Klasifikasi", "Uraian Arsip", "Tahun", "Jumlah", "Satuan", "Media", "Lokasi Simpan", "Masa Retensi (JRDP)", "Keterangan",
];

/** Template awal (placeholder). Admin PAM wajib menggantinya dengan template resmi perusahaan. */
export async function buildTemplateAssets() {
  const ibos = await xlsxBuffer("Data i-BOS", ["No", "Kode Dokumen", "Nama Dokumen", "Tanggal Dokumen", "Unit", "Keterangan"], [
    [1, "(contoh)", "(contoh) Isi dengan data tarikan i-BOS", "", "", ""],
  ]);
  const list = await xlsxBuffer("Daftar Arsip Usul Musnah", ARCHIVE_LIST_HEADER, [
    [1, "(contoh)", "(contoh) Faktur penjualan BBM", 2019, 12, "Box", "Kertas", "Gudang arsip SPBU", "5 tahun", ""],
  ]);
  const fupa = await pdfPlaceholder("Form FUPA (Placeholder)", [
    "Ini adalah berkas placeholder. Admin PAM harap mengunggah Form FUPA resmi",
    "melalui menu Pusat Template > Ubah Template.",
  ]);
  return { ibos, list, fupa };
}

/* -------------------------------- seed --------------------------------- */
export interface SeedOptions { demo: boolean }

export async function buildSeed(opts: SeedOptions = { demo: true }): Promise<Db> {
  const db = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Db;
  const nowIso = new Date().toISOString();

  db.ROLES.push(
    { role_id: "ADMIN_SPBU", role_name: "Admin SPBU", description: "Mengelola pengajuan usul musnah arsip untuk SPBU sendiri." },
    { role_id: "ADMIN_REGION", role_name: "Admin Region / PIC Region", description: "Review, pooling FUPA, dan pencatatan MEMO untuk Region sendiri." },
    { role_id: "ADMIN_PAM", role_name: "Admin PAM / Head Office", description: "Monitoring lintas Region dan pengelolaan master data, informasi, template, serta sumber AI." }
  );

  const regionIds = new Map<string, string>();
  for (const r of [...new Set((spbuMaster as any[]).map((s) => s.region))].sort((a, b) => Number(ROMAN[a]) - Number(ROMAN[b]))) {
    const id = `REG-${ROMAN[r]}`;
    regionIds.set(r, id);
    db.REGIONS.push({ region_id: id, region_name: `Region ${r}`, is_active: "1" });
  }
  for (const s of spbuMaster as any[]) {
    db.SPBUS.push({
      spbu_id: s.id, spbu_code: s.code, name: s.name, region_id: regionIds.get(s.region)!,
      province: s.province, city: s.city, address: s.address, pic_name: "", is_active: "1", created_at: nowIso,
    });
  }

  if (opts.demo) await seedDemo(db, nowIso);

  // Template awal (placeholder, jelas diberi label)
  const t = await buildTemplateAssets();
  const tpl = (id: string, name: string, cat: string, desc: string, usage: string, file: string, mime: string, buf: Buffer) =>
    db.TEMPLATES.push({
      template_id: id, name, category: cat, version: "0.1 (placeholder)", description: desc, usage_info: usage, status: "Aktif",
      updated_at: nowIso, updated_by: "Sistem", file_name: file, mime, size: String(buf.length),
      storage_ref: write(`templates/${file}`, buf), is_demo: "1",
    });
  const XL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  tpl("TPL-001", "Template Data Tarikan i-BOS", "Data i-BOS", "Format data hasil tarikan i-BOS yang disaring oleh Admin SPBU.", "Unduh, isi hasil tarikan i-BOS, lalu saring arsip yang akan diusulkan musnah.", "Template_Data_Tarikan_iBOS.xlsx", XL, t.ibos);
  tpl("TPL-002", "Template Form FUPA", "Form FUPA", "Form Usul Pemusnahan Arsip yang ditandatangani ABH.", "Cetak/isi form, tandatangani ABH, pindai menjadi PDF, lalu unggah pada pengajuan.", "Template_Form_FUPA.pdf", "application/pdf", t.fupa);
  tpl("TPL-003", "Template Daftar Arsip Usul Musnah", "Daftar Arsip", "Daftar arsip yang diusulkan musnah (Excel).", "Isi seluruh arsip yang diusulkan musnah sesuai JRDP, simpan sebagai .xlsx, lalu unggah pada pengajuan.", "Template_Daftar_Arsip_Usul_Musnah.xlsx", XL, t.list);

  // Dokumen pengetahuan: hanya metadata; file resmi diunggah Admin PAM.
  const kd: [string, string, string][] = [
    ["Pedoman Manajemen Dokumen", "Pedoman", "Pedoman pengelolaan dokumen perusahaan."],
    ["TKI C001 dan C002", "TKI", "Tata Kerja Individu terkait pengelolaan arsip."],
    ["Jadwal Retensi Dokumen Perusahaan (JRDP)", "Jadwal Retensi (JRDP)", "Daftar masa retensi dokumen perusahaan."],
    ["Buku Saku Lapangan Pengelolaan Arsip", "Buku Saku", "Ringkasan praktis pengelolaan arsip untuk petugas lapangan."],
    ["Sprint (Surat Perintah) Pengelolaan Arsip", "Sprint (Surat Perintah)", "Surat perintah resmi terkait pengelolaan dan pemusnahan arsip."],
    ["Manual Book Admin Unit - Penggunaan i-BOS", "Manual Book", "Panduan penggunaan i-BOS untuk Admin Unit."],
  ];
  kd.forEach(([title, cat, desc], i) =>
    db.KNOWLEDGE_DOCUMENTS.push({
      doc_id: `KD-${pad(i + 1)}`, title, category: cat, description: desc, version: "", status: "Aktif",
      managed_by: "Admin PAM", uploaded_at: "", file_name: "", mime: "", size: "0", storage_ref: "",
      use_for_ai: "1", ai_status: "Belum ada file", is_demo: "0",
    })
  );
  return db;
}

async function seedDemo(db: Db, nowIso: string) {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 8);
  let uid = 0;
  const user = (username: string, full: string, role: string, region = "", spbu = "") => {
    const id = `U-${pad(++uid)}`;
    db.USERS.push({
      user_id: id, username, full_name: full, email: `${username}@demo.invalid`, password_hash: hash, role_id: role,
      region_id: region, spbu_id: spbu, is_active: "1", is_demo: "1", created_at: nowIso, last_login: "",
    });
    return id;
  };
  const pam = user("pam.demo", "Admin PAM (Demo)", "ADMIN_PAM");
  const picByRegion = new Map<string, string>();
  for (const r of db.REGIONS) {
    const n = r.region_id.split("-")[1];
    picByRegion.set(r.region_id, user(`region${n}.demo`, `PIC ${r.region_name} (Demo)`, "ADMIN_REGION", r.region_id));
  }
  const userBySpbu = new Map<string, string>();
  for (const s of db.SPBUS) userBySpbu.set(s.spbu_id, user(`spbu${s.spbu_id}`, `Admin ${s.name}`, "ADMIN_SPBU", s.region_id, s.spbu_id));
  db.USERS.forEach((u) => { void u; });

  // Berkas demo bersama
  const demoXlsx = write("demo/DEMO_Daftar_Arsip_Usul_Musnah.xlsx", await xlsxBuffer("Daftar Arsip", ARCHIVE_LIST_HEADER, [
    [1, "(demo)", "Faktur penjualan BBM (data demo)", 2019, 12, "Box", "Kertas", "Gudang arsip", "5 tahun", "DATA DEMO"],
    [2, "(demo)", "Laporan harian stok (data demo)", 2018, 8, "Box", "Kertas", "Gudang arsip", "5 tahun", "DATA DEMO"],
  ]));
  const demoPdf = write("demo/DEMO_FUPA_Ditandatangani_ABH.pdf", await pdfPlaceholder("Form FUPA - Contoh (DATA DEMO)", ["Berkas contoh untuk demonstrasi alur GEMAS.", "Bukan dokumen operasional perusahaan."]));
  const demoImg = write("demo/DEMO_Foto_Arsip.png", png(360, 220, (x, y) => {
    const box = (x % 90 < 70 && y % 70 < 55 && y > 60);
    if (y > 160) return [150, 160, 170];
    if (box) return [196 - (x % 90), 160, 110];
    return [229, 241, 251];
  }));
  const demoFiles = [
    { ref: demoXlsx, name: "DEMO_Daftar_Arsip_Usul_Musnah.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    { ref: demoPdf, name: "DEMO_FUPA_Ditandatangani_ABH.pdf", mime: "application/pdf" },
    { ref: demoImg, name: "DEMO_Foto_Arsip.png", mime: "image/png" },
  ];

  // Transaksi demo
  const rand = rng(20260101);
  type S = { spbu: Row; date: Date; target: StatusValue; revised: boolean };
  const plan: S[] = [];
  const weights: [StatusValue, number][] = [
    [STATUS.REVIEW, 0.22], [STATUS.REVISION, 0.14], [STATUS.APPROVED, 0.18], [STATUS.POOLED, 0.2], [STATUS.MEMOED, 0.26],
  ];
  const pick = () => { let r = rand(), a = 0; for (const [s, w] of weights) { a += w; if (r <= a) return s; } return STATUS.REVIEW; };
  for (const s of db.SPBUS) {
    if (rand() > 0.42) continue;
    const times = rand() < 0.2 ? 2 : 1;
    for (let k = 0; k < times; k++) {
      const date = new Date(Date.UTC(2026, 0, 5) + Math.floor(rand() * 270) * 86400000 + Math.floor(rand() * 8) * 3600000);
      const target = pick();
      plan.push({ spbu: s, date, target, revised: target === STATUS.REVISION || rand() < 0.3 });
    }
  }
  plan.sort((a, b) => a.date.getTime() - b.date.getTime());

  let hid = 0, did = 0, pid = 0;
  const day = (d: Date, n: number) => new Date(d.getTime() + n * 86400000 + 3600000 * 2);
  const hist = (sid: string, from: string, to: string, by: string, name: string, role: string, at: Date, note = "") =>
    db.SUBMISSION_STATUS_HISTORY.push({
      history_id: `H-${pad(++hid, 5)}`, submission_id: sid, from_status: from, to_status: to,
      changed_by: by, changed_by_name: name, changed_by_role: role, changed_at: at.toISOString(), note,
    });
  const files = (sid: string, rev: string, by: string, at: Date, current: boolean) => {
    const docs: [number, string][] = [[0, "EXCEL"], [1, "FUPA_PDF"]];
    for (const [i, type] of docs)
      db.SUBMISSION_DOCUMENTS.push({
        doc_id: `DOC-${pad(++did, 5)}`, submission_id: sid, revision_id: rev, doc_type: type, file_name: demoFiles[i].name,
        mime: demoFiles[i].mime, size: "20480", storage_ref: demoFiles[i].ref, uploaded_by: by, uploaded_at: at.toISOString(),
        is_current: current ? "1" : "0", meta: type === "EXCEL" ? JSON.stringify({ rows: 2 }) : "",
      });
    for (let p = 0; p < 2; p++)
      db.SUBMISSION_PHOTOS.push({
        photo_id: `PH-${pad(++did, 5)}`, submission_id: sid, revision_id: rev, file_name: `DEMO_Foto_Arsip_${p + 1}.png`,
        mime: "image/png", size: "4096", storage_ref: demoImg, uploaded_by: by, uploaded_at: at.toISOString(), is_current: current ? "1" : "0",
      });
  };

  const byRegion = new Map<string, Row[]>();
  plan.forEach((p, i) => {
    const sid = `SUB-${pad(i + 1)}`;
    const spbuUser = userBySpbu.get(p.spbu.spbu_id)!;
    const spbuName = db.USERS.find((u) => u.user_id === spbuUser)!.full_name;
    const pic = picByRegion.get(p.spbu.region_id)!;
    const picName = db.USERS.find((u) => u.user_id === pic)!.full_name;
    const d0 = p.date;
    let t = d0;
    let status: string = STATUS.REVIEW;
    let curRev = 0;
    let lastNote = "";

    hist(sid, "", STATUS.UPLOADED, spbuUser, spbuName, "ADMIN_SPBU", d0, "Pengajuan dibuat dan dokumen diunggah.");
    hist(sid, STATUS.UPLOADED, STATUS.REVIEW, "SYSTEM", "Sistem", "SYSTEM", d0, "Otomatis masuk antrean review PIC Region.");
    files(sid, sid, spbuUser, d0, !p.revised);

    if (p.revised) {
      t = day(t, 1 + Math.floor(rand() * 3));
      curRev = 1;
      lastNote = "Daftar arsip belum mencantumkan masa retensi sesuai JRDP. Mohon dilengkapi dan unggah ulang. (data demo)";
      hist(sid, STATUS.REVIEW, STATUS.REVISION, pic, picName, "ADMIN_REGION", t, lastNote);
      const rev: Row = {
        revision_id: `${sid}-R1`, submission_id: sid, revision_no: "1", requested_note: lastNote, requested_by: pic,
        requested_by_name: picName, requested_at: t.toISOString(), resubmitted_at: "", resubmitted_by: "", resubmit_note: "",
      };
      status = STATUS.REVISION;
      if (p.target !== STATUS.REVISION) {
        t = day(t, 1 + Math.floor(rand() * 3));
        rev.resubmitted_at = t.toISOString(); rev.resubmitted_by = spbuUser; rev.resubmit_note = "Dokumen telah diperbaiki. (data demo)";
        files(sid, `${sid}-R1`, spbuUser, t, true);
        hist(sid, STATUS.REVISION, STATUS.UPLOADED, spbuUser, spbuName, "ADMIN_SPBU", t, "Dokumen revisi R1 diunggah.");
        hist(sid, STATUS.UPLOADED, STATUS.REVIEW, "SYSTEM", "Sistem", "SYSTEM", t, "Otomatis masuk antrean review PIC Region.");
        status = STATUS.REVIEW;
      }
      db.SUBMISSION_REVISION_HISTORY.push(rev);
    }
    if ([STATUS.APPROVED, STATUS.POOLED, STATUS.MEMOED].includes(p.target as any)) {
      t = day(t, 1 + Math.floor(rand() * 3));
      hist(sid, STATUS.REVIEW, STATUS.APPROVED, pic, picName, "ADMIN_REGION", t, "Dokumen sesuai. Disetujui.");
      status = STATUS.APPROVED;
      lastNote = "Dokumen sesuai. Disetujui.";
    }
    const row: Row = {
      submission_id: sid, spbu_id: p.spbu.spbu_id, region_id: p.spbu.region_id,
      submission_date: d0.toISOString().slice(0, 10), description: "Usul musnah arsip periode lama (data demo).",
      status, current_revision: String(curRev), submitted_by: spbuUser, created_at: d0.toISOString(),
      updated_at: t.toISOString(), last_review_note: lastNote, is_demo: "1",
    };
    db.SUBMISSIONS.push(row);
    (byRegion.get(p.spbu.region_id) || byRegion.set(p.spbu.region_id, []).get(p.spbu.region_id)!).push(row);
    (row as any)._target = p.target;
  });

  // Pooling & MEMO demo per Region
  let poolN = 0, memoN = 0, itemN = 0, fwdN = 0, mpi = 0;
  for (const [region, subs] of byRegion) {
    const pocket = subs.filter((s) => ["Sudah Masuk Pooling", "Sudah Di-Memo"].includes((s as any)._target));
    const pic = picByRegion.get(region)!;
    const picName = db.USERS.find((u) => u.user_id === pic)!.full_name;
    const regionNo = region.split("-")[1];
    const groups: Row[][] = [];
    for (let i = 0; i < pocket.length;) { const n = 2 + Math.floor(rand() * 3); groups.push(pocket.slice(i, i + n)); i += n; }
    const memoedPools: string[] = [];
    let memoDate = new Date();
    groups.forEach((g, gi) => {
      const poolId = `POOL-${pad(++poolN)}`;
      const latest = new Date(Math.max(...g.map((s) => new Date(s.updated_at).getTime())));
      const pd = day(latest, 1 + Math.floor(rand() * 2));
      const memoed = g.every((s) => (s as any)._target === STATUS.MEMOED);
      db.REGIONAL_POOLINGS.push({
        pooling_id: poolId, fupa_number: `FUPA/R${regionNo}/${pad(gi + 1)}/2026`, pooling_date: pd.toISOString().slice(0, 10),
        region_id: region, notes: "Pooling demo", status: "AKTIF", created_by: pic, created_at: pd.toISOString(), cancelled_at: "", cancel_reason: "",
      });
      for (const s of g) {
        db.REGIONAL_POOLING_ITEMS.push({ item_id: `PI-${pad(++itemN, 4)}`, pooling_id: poolId, submission_id: s.submission_id, spbu_id: s.spbu_id, status: "AKTIF", added_at: pd.toISOString() });
        hist(s.submission_id, STATUS.APPROVED, STATUS.POOLED, pic, picName, "ADMIN_REGION", pd, `Masuk pooling ${poolId}`);
        s.status = STATUS.POOLED; s.updated_at = pd.toISOString();
      }
      if (memoed) { memoedPools.push(poolId); memoDate = pd; }
    });
    // MEMO: gabungkan 1-2 pooling per MEMO
    for (let i = 0; i < memoedPools.length;) {
      const take = rand() < 0.4 ? 2 : 1;
      const set = memoedPools.slice(i, i + take); i += take;
      const memoId = `MEMO-${pad(++memoN)}`;
      const md = day(memoDate, 3 + Math.floor(rand() * 4));
      db.REGIONAL_MEMOS.push({
        memo_id: memoId, memo_number: `MEMO/R${regionNo}/${pad(memoN)}/2026`, memo_date: md.toISOString().slice(0, 10),
        region_id: region, notes: "MEMO demo", created_by: pic, created_at: md.toISOString(),
      });
      const fwd = rand() < 0.55;
      db.MEMO_FORWARDING.push({
        forwarding_id: `FWD-${pad(++fwdN)}`, memo_id: memoId, status: fwd ? FORWARD.YES : FORWARD.NO,
        forwarded_date: fwd ? day(md, 2).toISOString().slice(0, 10) : "", notes: fwd ? "Diteruskan ke PAM (demo)" : "", updated_by: pic, updated_at: md.toISOString(),
      });
      for (const poolId of set) {
        db.MEMO_POOLING_ITEMS.push({ id: `MP-${pad(++mpi, 4)}`, memo_id: memoId, pooling_id: poolId });
        for (const it of db.REGIONAL_POOLING_ITEMS.filter((x) => x.pooling_id === poolId)) {
          const s = db.SUBMISSIONS.find((x) => x.submission_id === it.submission_id)!;
          hist(s.submission_id, STATUS.POOLED, STATUS.MEMOED, pic, picName, "ADMIN_REGION", md, `Tercakup dalam ${memoId}`);
          s.status = STATUS.MEMOED; s.updated_at = md.toISOString();
        }
      }
    }
    // pooling yang tidak ber-memo: pastikan submission sisa konsisten
    for (const s of pocket) if ((s as any)._target === STATUS.MEMOED && s.status !== STATUS.MEMOED) s.status = STATUS.POOLED;
  }
  for (const s of db.SUBMISSIONS) delete (s as any)._target;
  db.ACTIVITY_LOGS.push({
    log_id: "LOG-00001", timestamp: nowIso, user_id: pam, user_name: "Sistem", role_id: "ADMIN_PAM",
    action: "SEED_DEMO", entity_type: "SYSTEM", entity_id: "-", details: "Data demo dibuat otomatis.",
  });
}
