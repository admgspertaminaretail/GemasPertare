import { getStore } from "../db";
import { readFile } from "../storage";
import { nowIso } from "./core";
import { Row } from "../schema";

/* ------------------------------------------------------------------ teks */
const STOP = new Set(("yang dan di ke dari untuk pada dengan atau adalah itu ini dalam akan oleh sebagai juga tidak dapat harus " +
  "saya kami kita anda apa bagaimana kapan siapa mengapa berapa ada jika bila agar sudah telah para sebuah suatu nya lebih serta " +
  "mohon tolong jelaskan tentang cara").split(" "));
const tok = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

/** Panduan fungsi aplikasi GEMAS (bukan kebijakan perusahaan). Ditandai terpisah dalam jawaban. */
export const APP_GUIDE: { page: string; title: string; text: string }[] = [
  { page: "Alur Pengajuan", title: "Alur pengajuan usul musnah di GEMAS", text:
    "Alur pengajuan usul musnah arsip di GEMAS: (1) Admin SPBU mengunduh data tarikan i-BOS dari Pusat Template, menyaring data, menyusun daftar arsip dan memotret kondisi fisik arsip. (2) Admin SPBU membuka menu Pengajuan Usul Musnah Arsip, klik Buat Pengajuan, lalu mengunggah Excel Daftar Arsip Usul Musnah, PDF Form FUPA yang sudah ditandatangani ABH, dan foto kondisi fisik arsip. (3) PIC Region mereview: Disetujui atau Perlu Revisi dengan catatan. (4) PIC Region melakukan pooling pengajuan yang disetujui ke satu FUPA Regional. (5) PIC Region mencatat nomor dan tanggal MEMO. (6) PIC Region mencatat apakah MEMO sudah diteruskan ke PAM. Persetujuan Manager/VP dan pembuatan MEMO dilakukan di luar GEMAS." },
  { page: "Status", title: "Arti status pengajuan", text:
    "Status pengajuan di GEMAS: PIC SPBU Sudah Upload; PIC Region Perlu Review; Perlu Revisi (SPBU harus memperbaiki dokumen sesuai catatan revisi); Disetujui; Sudah Masuk Pooling (sudah tergabung dalam FUPA Regional); Sudah Di-Memo (MEMO Regional sudah dicatat). Penerusan MEMO ke PAM adalah informasi monitoring terpisah." },
  { page: "Revisi", title: "Cara mengunggah revisi", text:
    "Jika status Perlu Revisi, Admin SPBU membuka detail pengajuan, membaca catatan revisi PIC Region, lalu klik Unggah Revisi dan mengunggah dokumen perbaikan. Dokumen lama tidak dihapus; semua versi tersimpan dengan ID revisi seperti SUB-001-R1 dan SUB-001-R2." },
  { page: "Menu", title: "Menu utama GEMAS", text:
    "Menu GEMAS: Dashboard Monitoring (ringkasan dan progres), Pusat Informasi Arsip (pedoman, TKI, JRDP, buku saku, materi, manual book i-BOS), Pusat Template (template data i-BOS, Form FUPA, Daftar Arsip Usul Musnah), Pengajuan Usul Musnah Arsip (pengajuan, pooling, MEMO), dan Tanya si GEMAS (asisten AI)." },
  { page: "Pooling", title: "Pooling FUPA Regional", text:
    "Pooling dilakukan PIC Region di menu Pengajuan Usul Musnah Arsip, tab Pooling FUPA: pilih beberapa pengajuan berstatus Disetujui dengan checkbox, isi Nomor FUPA Regional dan tanggal pooling, lalu klik Buat Pooling. Satu pengajuan tidak dapat masuk dua pooling aktif sekaligus; pembatalan pooling harus disertai alasan." },
  { page: "MEMO", title: "Pencatatan MEMO dan penerusan ke PAM", text:
    "PIC Region mencatat MEMO di tab MEMO: isi nomor MEMO, tanggal, pilih satu atau beberapa FUPA Regional (pooling) yang tercakup. Setelah itu catat status penerusan ke PAM (Belum/Sudah Diteruskan) beserta tanggal." },
];

/* ------------------------------------------------------------- ingestion */
function chunkText(text: string, size = 900, overlap = 150) {
  const clean = text.replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);
    if (end < clean.length) {
      const cut = Math.max(clean.lastIndexOf(". ", end), clean.lastIndexOf("\n", end));
      if (cut > i + size * 0.5) end = cut + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece.length > 30) out.push(piece);
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out;
}

async function extractPages(buf: Buffer): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse/lib/pdf-parse.js");
  const pages: string[] = [];
  await pdfParse(buf, {
    pagerender: async (pageData: any) => {
      const tc = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      let lastY: number | undefined, text = "";
      for (const item of tc.items) {
        text += lastY === item.transform[5] || lastY === undefined ? item.str : "\n" + item.str;
        lastY = item.transform[5];
      }
      pages.push(text);
      return text;
    },
  });
  return pages;
}

/** Mengindeks dokumen pengetahuan (PDF) ke AI_KNOWLEDGE_BASE dengan metadata dokumen & halaman. */
export async function ingestDocument(docId: string): Promise<string> {
  const store = await getStore();
  const doc = (await store.list("KNOWLEDGE_DOCUMENTS")).find((d) => d.doc_id === docId);
  if (!doc) throw new Error("Dokumen tidak ditemukan.");
  await store.deleteWhere("AI_KNOWLEDGE_BASE", (r) => r.doc_id === docId);
  if (!doc.storage_ref) { await store.update("KNOWLEDGE_DOCUMENTS", docId, { ai_status: "Belum ada file" }); return "Belum ada file"; }
  if (doc.use_for_ai !== "1") { await store.update("KNOWLEDGE_DOCUMENTS", docId, { ai_status: "Tidak dipakai AI" }); return "Tidak dipakai AI"; }
  let status = "";
  try {
    let pages: string[] = [];
    if (doc.mime === "application/pdf") pages = await extractPages(await readFile(doc.storage_ref));
    else { status = "Format tidak didukung AI (hanya PDF)"; }
    const rows: Row[] = [];
    pages.forEach((p, pi) =>
      chunkText(p).forEach((c, ci) =>
        rows.push({ chunk_id: `${docId}-P${pi + 1}-${ci + 1}`, doc_id: docId, doc_title: doc.title, doc_version: doc.version, page: String(pi + 1), chunk_index: String(ci + 1), text: c, created_at: nowIso() })
      )
    );
    if (rows.length) { await store.insert("AI_KNOWLEDGE_BASE", rows); status = `Terindeks (${rows.length} potongan, ${pages.length} hal.)`; }
    else if (!status) status = "Tidak ada teks terbaca (PDF hasil pindai?)";
  } catch (e: any) {
    status = `Gagal diindeks: ${String(e.message || e).slice(0, 80)}`;
  }
  await store.update("KNOWLEDGE_DOCUMENTS", docId, { ai_status: status });
  return status;
}

/* -------------------------------------------------------------- retrieval */
export interface Hit { id: string; title: string; version: string; page: string; text: string; score: number; kind: "official" | "app" }

function bm25(query: string, docs: { tokens: string[] }[]) {
  const q = [...new Set(tok(query))];
  const N = docs.length || 1;
  const avg = docs.reduce((a, d) => a + d.tokens.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const t of q) df.set(t, docs.filter((d) => d.tokens.includes(t)).length);
  return docs.map((d) => {
    let s = 0;
    for (const t of q) {
      const f = d.tokens.filter((x) => x === t).length;
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(t)! + 0.5) / (df.get(t)! + 0.5));
      s += (idf * (f * 2.2)) / (f + 1.2 * (0.25 + 0.75 * (d.tokens.length / avg)));
    }
    return s;
  });
}

export async function retrieve(query: string, k = 5): Promise<Hit[]> {
  const store = await getStore();
  const [chunks, docs] = await Promise.all([store.list("AI_KNOWLEDGE_BASE"), store.list("KNOWLEDGE_DOCUMENTS")]);
  const active = new Set(docs.filter((d) => d.status === "Aktif" && d.use_for_ai === "1").map((d) => d.doc_id));
  const official = chunks.filter((c) => active.has(c.doc_id));
  const pool = [
    ...official.map((c) => ({ id: c.chunk_id, title: c.doc_title, version: c.doc_version, page: c.page, text: c.text, kind: "official" as const, tokens: tok(c.doc_title + " " + c.text) })),
    ...APP_GUIDE.map((g, i) => ({ id: `APP-${i}`, title: "Panduan Aplikasi GEMAS", version: "", page: g.page, text: g.text, kind: "app" as const, tokens: tok(g.title + " " + g.text) })),
  ];
  const scores = bm25(query, pool);
  return pool
    .map((p, i) => ({ id: p.id, title: p.title, version: p.version, page: p.page, text: p.text, kind: p.kind, score: scores[i] }))
    .filter((h) => h.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/* ----------------------------------------------------------------- jawab */
export interface AiAnswer {
  answer: string;
  mode: "llm" | "extractive" | "not_found";
  sources: { title: string; page: string; version: string; kind: "official" | "app"; snippet: string }[];
  links: { label: string; href: string }[];
}

const NOT_FOUND =
  "Maaf, informasi tersebut belum saya temukan di dokumen resmi yang tersedia di GEMAS. Mohon konfirmasi kepada **Document Controller** agar mendapat jawaban yang pasti. Saya tidak membuat kebijakan atau prosedur sendiri.";

async function findLinks(question: string): Promise<AiAnswer["links"]> {
  const store = await getStore();
  const q = tok(question);
  const links: AiAnswer["links"] = [];
  if (q.some((w) => ["template", "form", "fupa", "unduh", "download", "format", "ibos", "bos"].includes(w))) {
    for (const t of (await store.list("TEMPLATES")).filter((t) => t.status === "Aktif")) {
      const tt = tok(t.name + " " + t.category);
      if (tt.some((w) => q.includes(w) && !["template", "data", "daftar"].includes(w)) || q.includes("template"))
        links.push({ label: `Unduh: ${t.name}`, href: `/api/files/template/${t.template_id}` });
    }
    links.push({ label: "Buka Pusat Template", href: "/templates" });
  }
  if (q.some((w) => ["ajukan", "pengajuan", "musnah", "pemusnahan", "revisi", "pooling", "memo"].includes(w))) links.push({ label: "Buka Pengajuan Usul Musnah Arsip", href: "/submissions" });
  if (q.some((w) => ["jrdp", "retensi", "pedoman", "tki", "buku", "manual"].includes(w))) links.push({ label: "Buka Pusat Informasi Arsip", href: "/info" });
  if (q.some((w) => ["dashboard", "monitoring", "progres"].includes(w))) links.push({ label: "Buka Dashboard Monitoring", href: "/dashboard" });
  return links.filter((l, i, a) => a.findIndex((x) => x.href === l.href) === i).slice(0, 5);
}

async function callGemini(question: string, hits: Hit[], history: { role: string; text: string }[]) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const ctx = hits.map((h, i) => `[${i + 1}] (${h.kind === "official" ? "DOKUMEN RESMI" : "PANDUAN APLIKASI"}) ${h.title}${h.version ? ` v${h.version}` : ""}, hal. ${h.page}\n${h.text}`).join("\n\n");
  const system =
    "Kamu adalah 'Tanya si GEMAS', asisten pengelolaan arsip PT Pertamina Retail. Jawab dalam Bahasa Indonesia yang ramah dan mudah dipahami.\n" +
    "ATURAN KETAT: (1) Jawab HANYA berdasarkan KONTEKS di bawah. (2) Jangan membuat kebijakan, angka, masa retensi, atau prosedur yang tidak ada di konteks. " +
    "(3) Cantumkan rujukan dengan format [n] setelah kalimat yang bersumber dari konteks. (4) Pisahkan dengan jelas bagian 'Berdasarkan dokumen resmi' dan 'Penjelasan umum' (jika ada; penjelasan umum harus singkat dan diberi label bukan kebijakan). " +
    "(5) Jika konteks tidak cukup, katakan informasi perlu dikonfirmasi kepada Document Controller.";
  const contents = [
    ...history.slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: `KONTEKS:\n${ctx}\n\nPERTANYAAN: ${question}` }] },
  ];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.2, maxOutputTokens: 900 } }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";
  return text.trim() || null;
}

export async function askGemas(question: string, history: { role: string; text: string }[] = []): Promise<AiAnswer> {
  const q = question.trim().slice(0, 600);
  const links = await findLinks(q);
  const hits = await retrieve(q, 5);
  const toSources = (hs: Hit[]) => hs.map((h) => ({ title: h.title, page: h.page, version: h.version, kind: h.kind, snippet: h.text.slice(0, 220) + (h.text.length > 220 ? "…" : "") }));
  if (!hits.length) return { answer: NOT_FOUND, mode: "not_found", sources: [], links };
  try {
    const text = await callGemini(q, hits, history);
    if (text) return { answer: text, mode: "llm", sources: toSources(hits), links };
  } catch {
    /* jatuh ke mode kutipan */
  }
  const official = hits.filter((h) => h.kind === "official").slice(0, 3);
  const app = hits.filter((h) => h.kind === "app").slice(0, 1);
  let ans = "";
  if (official.length) ans += "**Berdasarkan dokumen resmi:**\n\n" + official.map((h, i) => `${i + 1}. ${h.text.slice(0, 500)}${h.text.length > 500 ? "…" : ""} _(${h.title}, hal. ${h.page})_`).join("\n\n");
  if (app.length) ans += (ans ? "\n\n" : "") + "**Penjelasan penggunaan aplikasi GEMAS (bukan kebijakan perusahaan):**\n\n" + app[0].text;
  if (!official.length && !app.length) ans = NOT_FOUND;
  else if (!official.length) ans += "\n\n_Catatan: belum ada kutipan dokumen resmi yang relevan. Untuk ketentuan kebijakan, konfirmasikan kepada Document Controller._";
  return { answer: ans, mode: "extractive", sources: toSources([...official, ...app]), links };
}
