import ExcelJS from "exceljs";
import { getStore } from "../db";
import { SessionUser, HttpError, requireUser } from "../auth";
import { Row } from "../schema";
import { DOC_TYPE, FORWARD, STATUS, StatusValue } from "../constants";
import { saveFile, validateUpload, ValidatedFile } from "../storage";
import { assertScope, canAccessScope, logActivity, nextId, nowIso, today } from "./core";

export interface SubmissionView extends Row {
  spbu_name: string;
  spbu_code: string;
  region_name: string;
  fupa_number: string;
  pooling_id: string;
  memo_id: string;
  memo_number: string;
  memo_date: string;
}

/** Menggabungkan pengajuan dengan SPBU, Region, pooling aktif, dan MEMO. */
export async function enrich(subs: Row[]): Promise<SubmissionView[]> {
  const store = await getStore();
  const [spbus, regions, items, pools, mpi, memos] = await Promise.all([
    store.list("SPBUS"), store.list("REGIONS"), store.list("REGIONAL_POOLING_ITEMS"), store.list("REGIONAL_POOLINGS"),
    store.list("MEMO_POOLING_ITEMS"), store.list("REGIONAL_MEMOS"),
  ]);
  const sp = new Map(spbus.map((s) => [s.spbu_id, s]));
  const rg = new Map(regions.map((r) => [r.region_id, r]));
  const pl = new Map(pools.map((p) => [p.pooling_id, p]));
  const mm = new Map(memos.map((m) => [m.memo_id, m]));
  const activeItem = new Map(items.filter((i) => i.status === "AKTIF").map((i) => [i.submission_id, i]));
  const memoOfPool = new Map(mpi.map((m) => [m.pooling_id, m.memo_id]));
  return subs.map((s) => {
    const it = activeItem.get(s.submission_id);
    const pool = it ? pl.get(it.pooling_id) : undefined;
    const memo = pool ? mm.get(memoOfPool.get(pool.pooling_id) || "") : undefined;
    return {
      ...s,
      spbu_name: sp.get(s.spbu_id)?.name || s.spbu_id,
      spbu_code: sp.get(s.spbu_id)?.spbu_code || "",
      region_name: rg.get(s.region_id)?.region_name || s.region_id,
      fupa_number: pool?.fupa_number || "",
      pooling_id: pool?.pooling_id || "",
      memo_id: memo?.memo_id || "",
      memo_number: memo?.memo_number || "",
      memo_date: memo?.memo_date || "",
    };
  });
}

/** Seluruh pengajuan dalam lingkup user. */
export async function listSubmissions(u: SessionUser): Promise<SubmissionView[]> {
  const store = await getStore();
  let subs = await store.list("SUBMISSIONS");
  if (u.role === "ADMIN_REGION") subs = subs.filter((s) => s.region_id === u.regionId);
  if (u.role === "ADMIN_SPBU") subs = subs.filter((s) => s.spbu_id === u.spbuId);
  const out = await enrich(subs);
  return out.sort((a, b) => b.submission_id.localeCompare(a.submission_id));
}

async function addHistory(
  u: Pick<SessionUser, "userId" | "name" | "role"> | null, sid: string, from: string, to: string, note: string
) {
  const store = await getStore();
  await store.insert("SUBMISSION_STATUS_HISTORY", [
    {
      history_id: `H-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      submission_id: sid, from_status: from, to_status: to, changed_by: u?.userId || "SYSTEM",
      changed_by_name: u?.name || "Sistem", changed_by_role: u?.role || "SYSTEM", changed_at: nowIso(), note,
    },
  ]);
}

export async function setStatus(u: SessionUser | null, sid: string, to: StatusValue, note: string, extra: Partial<Row> = {}) {
  const store = await getStore();
  const sub = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === sid);
  if (!sub) throw new HttpError(404, "Pengajuan tidak ditemukan.");
  await addHistory(u, sid, sub.status, to, note);
  await store.update("SUBMISSIONS", sid, { status: to, updated_at: nowIso(), ...extra });
}

export async function getSubmissionDetail(u: SessionUser, id: string) {
  const store = await getStore();
  const raw = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === id);
  if (!raw) return null;
  if (!canAccessScope(u, raw.region_id, raw.spbu_id)) return null;
  const [sub] = await enrich([raw]);
  const [docs, photos, revs, hist, spbu, forwards] = await Promise.all([
    store.list("SUBMISSION_DOCUMENTS"), store.list("SUBMISSION_PHOTOS"), store.list("SUBMISSION_REVISION_HISTORY"),
    store.list("SUBMISSION_STATUS_HISTORY"), store.list("SPBUS"), store.list("MEMO_FORWARDING"),
  ]);
  return {
    submission: sub,
    spbu: spbu.find((s) => s.spbu_id === raw.spbu_id)!,
    documents: docs
      .filter((d) => d.submission_id === id && (d.doc_type === DOC_TYPE.EXCEL || d.doc_type === DOC_TYPE.FUPA))
      .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at)),
    photos: photos.filter((d) => d.submission_id === id).sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at)),
    revisions: revs.filter((r) => r.submission_id === id).sort((a, b) => Number(a.revision_no) - Number(b.revision_no)),
    history: hist.filter((h) => h.submission_id === id).sort((a, b) => a.changed_at.localeCompare(b.changed_at)),
    forwarding: sub.memo_id ? forwards.find((f) => f.memo_id === sub.memo_id) || null : null,
  };
}

function cellStr(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((rt: any) => rt?.text ?? "").join("").trim();
    const inner = v.text ?? v.result ?? "";
    if (inner instanceof Date) return inner.toISOString().slice(0, 10);
    return String(inner).trim();
  }
  return String(v).trim();
}

export interface ParsedExcelTable {
  sheet: string;
  totalRows: number;
  headers: string[];
  previewRows: string[][];
}

export async function parseExcelStructured(f: ValidatedFile, label: string): Promise<ParsedExcelTable> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(f.buffer as any);
  } catch {
    throw new Error(`${label}: file Excel tidak dapat dibaca. Pastikan file berformat .xlsx yang valid.`);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error(`${label}: file Excel tidak memiliki lembar kerja.`);
  const nonEmpty: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const vals = ((row.values as any[]) || []).slice(1).map(cellStr);
    while (vals.length > 0 && vals[vals.length - 1] === "") vals.pop();
    if (vals.some((c) => c !== "")) nonEmpty.push(vals);
  });
  if (nonEmpty.length < 2) {
    throw new Error(`${label} belum berisi data. Isi minimal satu baris data di bawah baris judul kolom.`);
  }
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, nonEmpty.length - 1); i++) {
    if (nonEmpty[i].filter((c) => c !== "").length >= 2) {
      headerIdx = i;
      break;
    }
  }
  const rawData = nonEmpty.slice(headerIdx + 1);
  if (rawData.length < 1) {
    throw new Error(`${label} belum berisi baris data di bawah header.`);
  }
  const maxCols = Math.min(
    16,
    Math.max(nonEmpty[headerIdx].length, ...rawData.slice(0, 250).map((r) => r.length), 1)
  );
  const headers = Array.from({ length: maxCols }, (_, i) => nonEmpty[headerIdx][i] || `Kolom ${i + 1}`);
  const previewRows = rawData.slice(0, 250).map((r) =>
    Array.from({ length: maxCols }, (_, i) => (r[i] || "").slice(0, 180))
  );
  return {
    sheet: ws.name || "Data",
    totalRows: rawData.length,
    headers,
    previewRows,
  };
}

export function packExcelMeta(parsed: ParsedExcelTable, extra: Record<string, string> = {}): string {
  const rows = [...parsed.previewRows];
  let json = JSON.stringify({
    ...extra,
    rows: parsed.totalRows,
    totalRows: parsed.totalRows,
    sheet: parsed.sheet,
    headers: parsed.headers,
    previewRows: rows,
  });
  while (json.length > 38000 && rows.length > 10) {
    rows.splice(Math.floor(rows.length * 0.75));
    json = JSON.stringify({
      ...extra,
      rows: parsed.totalRows,
      totalRows: parsed.totalRows,
      sheet: parsed.sheet,
      headers: parsed.headers,
      previewRows: rows,
    });
  }
  return json;
}

function fileList(fd: FormData, key: string): File[] {
  return fd.getAll(key).filter((x): x is File => typeof x !== "string" && (x as File).size > 0);
}

async function saveDoc(
  u: SessionUser, sid: string, rev: string, type: string, f: ValidatedFile, meta = ""
) {
  const store = await getStore();
  const ref = await saveFile(f, `submissions/${sid}`, { title: `${rev} — ${type} (${f.name})`, entityId: rev, uploadedBy: u.name });
  const id = `DOC-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  await store.insert("SUBMISSION_DOCUMENTS", [
    { doc_id: id, submission_id: sid, revision_id: rev, doc_type: type, file_name: f.name, mime: f.mime, size: String(f.size),
      storage_ref: ref, uploaded_by: u.userId, uploaded_at: nowIso(), is_current: "1", meta },
  ]);
  return id;
}
async function savePhoto(u: SessionUser, sid: string, rev: string, f: ValidatedFile) {
  const store = await getStore();
  const ref = await saveFile(f, `submissions/${sid}`, { title: `${rev} — Foto Arsip (${f.name})`, entityId: rev, uploadedBy: u.name });
  await store.insert("SUBMISSION_PHOTOS", [
    { photo_id: `PH-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase(), submission_id: sid, revision_id: rev,
      file_name: f.name, mime: f.mime, size: String(f.size), storage_ref: ref, uploaded_by: u.userId, uploaded_at: nowIso(), is_current: "1" },
  ]);
}

/** Tahap 2 - Admin SPBU membuat pengajuan baru. */
export async function createSubmission(u: SessionUser, fd: FormData) {
  if (u.role !== "ADMIN_SPBU") throw new HttpError(403, "Hanya Admin SPBU yang dapat membuat pengajuan.");
  const store = await getStore();
  const spbu = (await store.list("SPBUS")).find((s) => s.spbu_id === u.spbuId);
  if (!spbu || spbu.is_active !== "1") throw new HttpError(400, "SPBU Anda tidak aktif / tidak ditemukan.");
  const date = String(fd.get("submission_date") || today());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) throw new HttpError(400, "Tanggal pengajuan tidak valid (tidak boleh di masa depan).");
  const description = String(fd.get("description") || "").trim();
  if (description.length < 5) throw new HttpError(400, "Keterangan pengajuan wajib diisi (minimal 5 karakter).");
  if (description.length > 1000) throw new HttpError(400, "Keterangan terlalu panjang (maks. 1000 karakter).");

  const errors: string[] = [];
  let excel: ValidatedFile | undefined, fupa: ValidatedFile | undefined;
  let parsedExcel: ParsedExcelTable | undefined;
  const photos: ValidatedFile[] = [];
  try {
    excel = await validateUpload(fileList(fd, "excel")[0], "excel", "Excel Daftar Arsip Usul Musnah");
    parsedExcel = await parseExcelStructured(excel, "Daftar Arsip Usul Musnah (Excel)");
  } catch (e: any) { errors.push(e.message); }
  try { fupa = await validateUpload(fileList(fd, "fupa")[0], "pdf", "PDF Arsip Usul Musnah"); } catch (e: any) { errors.push(e.message); }
  const pf = fileList(fd, "photos");
  if (!pf.length) errors.push("Foto kondisi fisik arsip wajib diunggah (minimal 1).");
  if (pf.length > 10) errors.push("Foto maksimal 10 berkas.");
  for (const p of pf.slice(0, 10)) {
    try { photos.push(await validateUpload(p, "image", `Foto ${p.name}`)); } catch (e: any) { errors.push((e as Error).message); }
  }
  if (errors.length) throw new HttpError(400, errors.join(" "));

  const all = await store.list("SUBMISSIONS");
  const sid = nextId("SUB", all, "submission_id");
  const t = nowIso();
  await store.insert("SUBMISSIONS", [
    { submission_id: sid, spbu_id: spbu.spbu_id, region_id: spbu.region_id, submission_date: date, description, status: STATUS.UPLOADED,
      current_revision: "0", submitted_by: u.userId, created_at: t, updated_at: t, last_review_note: "", is_demo: "0" },
  ]);
  await saveDoc(u, sid, sid, DOC_TYPE.EXCEL, excel!, packExcelMeta(parsedExcel!, { period: date.slice(0, 7) }));
  await saveDoc(u, sid, sid, DOC_TYPE.FUPA, fupa!);
  for (const p of photos) await savePhoto(u, sid, sid, p);
  const store2 = await getStore();
  await store2.insert("SUBMISSION_STATUS_HISTORY", [
    { history_id: `H-${Date.now().toString(36)}A`.toUpperCase(), submission_id: sid, from_status: "", to_status: STATUS.UPLOADED, changed_by: u.userId,
      changed_by_name: u.name, changed_by_role: u.role, changed_at: t, note: "Pengajuan dibuat dan dokumen diunggah." },
  ]);
  await setStatus(null, sid, STATUS.REVIEW, "Otomatis masuk antrean review PIC Region.");
  await logActivity(u, "UPLOAD_PENGAJUAN", "SUBMISSION", sid, `${spbu.name}: 2 dokumen + ${photos.length} foto`);
  return sid;
}

/** Tahap 3 - PIC Region menyetujui atau meminta revisi. */
export async function reviewSubmission(u: SessionUser, sid: string, decision: "approve" | "revise", note: string) {
  if (u.role !== "ADMIN_REGION") throw new HttpError(403, "Hanya PIC Region yang dapat melakukan review.");
  const store = await getStore();
  const sub = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === sid);
  if (!sub) throw new HttpError(404, "Pengajuan tidak ditemukan.");
  assertScope(u, sub.region_id);
  if (sub.status !== STATUS.REVIEW) throw new HttpError(409, `Pengajuan berstatus "${sub.status}" dan tidak dapat direview.`);
  note = (note || "").trim();
  if (decision === "revise") {
    if (note.length < 5) throw new HttpError(400, "Catatan revisi wajib diisi (minimal 5 karakter).");
    const n = Number(sub.current_revision) + 1;
    await store.insert("SUBMISSION_REVISION_HISTORY", [
      { revision_id: `${sid}-R${n}`, submission_id: sid, revision_no: String(n), requested_note: note, requested_by: u.userId,
        requested_by_name: u.name, requested_at: nowIso(), resubmitted_at: "", resubmitted_by: "", resubmit_note: "" },
    ]);
    await setStatus(u, sid, STATUS.REVISION, note, { current_revision: String(n), last_review_note: note });
    await logActivity(u, "MINTA_REVISI", "SUBMISSION", sid, `${sid}-R${n}: ${note}`);
  } else {
    await setStatus(u, sid, STATUS.APPROVED, note || "Dokumen sesuai. Disetujui.", { last_review_note: note || "Disetujui" });
    await logActivity(u, "SETUJUI_PENGAJUAN", "SUBMISSION", sid, note);
  }
}

/** Admin SPBU mengunggah dokumen hasil revisi. Dokumen lama tetap tersimpan (is_current = 0). */
export async function resubmit(u: SessionUser, sid: string, fd: FormData) {
  if (u.role !== "ADMIN_SPBU") throw new HttpError(403, "Hanya Admin SPBU yang dapat mengunggah revisi.");
  const store = await getStore();
  const sub = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === sid);
  if (!sub) throw new HttpError(404, "Pengajuan tidak ditemukan.");
  assertScope(u, sub.region_id, sub.spbu_id);
  if (sub.status !== STATUS.REVISION) throw new HttpError(409, "Pengajuan ini tidak sedang meminta revisi.");
  const rev = (await store.list("SUBMISSION_REVISION_HISTORY")).find((r) => r.submission_id === sid && r.revision_no === sub.current_revision);
  if (!rev) throw new HttpError(500, "Data revisi tidak ditemukan.");

  const errors: string[] = [];
  let excel: ValidatedFile | undefined, fupa: ValidatedFile | undefined;
  let parsedExcel: ParsedExcelTable | undefined;
  const photos: ValidatedFile[] = [];
  const e0 = fileList(fd, "excel")[0], f0 = fileList(fd, "fupa")[0], pf = fileList(fd, "photos");
  if (e0) try { excel = await validateUpload(e0, "excel", "Excel Daftar Arsip"); parsedExcel = await parseExcelStructured(excel, "Excel Daftar Arsip"); } catch (e: any) { errors.push(e.message); }
  if (f0) try { fupa = await validateUpload(f0, "pdf", "PDF Arsip Usul Musnah"); } catch (e: any) { errors.push(e.message); }
  for (const p of pf.slice(0, 10)) try { photos.push(await validateUpload(p, "image", `Foto ${p.name}`)); } catch (e: any) { errors.push(e.message); }
  if (!e0 && !f0 && !pf.length) errors.push("Unggah minimal satu dokumen hasil perbaikan.");
  if (errors.length) throw new HttpError(400, errors.join(" "));

  const revId = rev.revision_id;
  if (excel && parsedExcel) { await markOld("SUBMISSION_DOCUMENTS", sid, (r) => r.doc_type === DOC_TYPE.EXCEL); await saveDoc(u, sid, revId, DOC_TYPE.EXCEL, excel, packExcelMeta(parsedExcel, { period: sub.submission_date.slice(0, 7) })); }
  if (fupa) { await markOld("SUBMISSION_DOCUMENTS", sid, (r) => r.doc_type === DOC_TYPE.FUPA); await saveDoc(u, sid, revId, DOC_TYPE.FUPA, fupa); }
  if (photos.length) { await markOld("SUBMISSION_PHOTOS", sid, () => true); for (const p of photos) await savePhoto(u, sid, revId, p); }
  const note = String(fd.get("note") || "").trim();
  await store.update("SUBMISSION_REVISION_HISTORY", revId, { resubmitted_at: nowIso(), resubmitted_by: u.userId, resubmit_note: note });
  await setStatus(u, sid, STATUS.UPLOADED, `Dokumen revisi ${revId} diunggah. ${note}`.trim());
  await setStatus(null, sid, STATUS.REVIEW, "Otomatis masuk antrean review PIC Region.");
  await logActivity(u, "UPLOAD_REVISI", "SUBMISSION", sid, revId);
}

async function markOld(table: "SUBMISSION_DOCUMENTS" | "SUBMISSION_PHOTOS", sid: string, pred: (r: Row) => boolean) {
  const store = await getStore();
  const key = table === "SUBMISSION_DOCUMENTS" ? "doc_id" : "photo_id";
  for (const r of await store.list(table)) if (r.submission_id === sid && r.is_current === "1" && pred(r)) await store.update(table, r[key], { is_current: "0" });
}

/* ---------------------------------------------------------------- Pooling */
export async function listPoolings(u: SessionUser): Promise<any[]> {
  const store = await getStore();
  let pools = await store.list("REGIONAL_POOLINGS");
  if (u.role === "ADMIN_REGION") pools = pools.filter((p) => p.region_id === u.regionId);
  if (u.role === "ADMIN_SPBU") return [];
  const [items, subs, mpi, memos, regions, spbus] = await Promise.all([
    store.list("REGIONAL_POOLING_ITEMS"), store.list("SUBMISSIONS"), store.list("MEMO_POOLING_ITEMS"), store.list("REGIONAL_MEMOS"),
    store.list("REGIONS"), store.list("SPBUS"),
  ]);
  const sp = new Map(spbus.map((s) => [s.spbu_id, s.name]));
  return pools
    .map((p) => {
      const members = items.filter((i) => i.pooling_id === p.pooling_id && i.status === "AKTIF").map((i) => ({
        submission_id: i.submission_id, spbu_id: i.spbu_id, spbu_name: sp.get(i.spbu_id) || i.spbu_id,
        status: subs.find((s) => s.submission_id === i.submission_id)?.status || "",
      }));
      const link = mpi.find((m) => m.pooling_id === p.pooling_id);
      const memo = link ? memos.find((m) => m.memo_id === link.memo_id) : undefined;
      return { ...p, region_name: regions.find((r) => r.region_id === p.region_id)?.region_name || p.region_id, members,
        memo_id: memo?.memo_id || "", memo_number: memo?.memo_number || "" };
    })
    .sort((a: any, b: any) => b.pooling_id.localeCompare(a.pooling_id));
}

export async function listPoolable(u: SessionUser) {
  const subs = (await listSubmissions(u)).filter((s) => s.status === STATUS.APPROVED);
  return subs;
}

export async function createPooling(u: SessionUser, input: { fupa_number: string; pooling_date: string; submission_ids: string[]; notes?: string }) {
  if (u.role !== "ADMIN_REGION") throw new HttpError(403, "Hanya PIC Region yang dapat membuat pooling.");
  const store = await getStore();
  const fupa = (input.fupa_number || "").trim();
  if (fupa.length < 3) throw new HttpError(400, "Nomor FUPA Regional wajib diisi.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.pooling_date || "") || input.pooling_date > today()) throw new HttpError(400, "Tanggal pooling tidak valid.");
  const ids = [...new Set(input.submission_ids || [])];
  if (!ids.length) throw new HttpError(400, "Pilih minimal satu pengajuan.");
  const [pools, items, allSubs] = await Promise.all([store.list("REGIONAL_POOLINGS"), store.list("REGIONAL_POOLING_ITEMS"), store.list("SUBMISSIONS")]);
  if (pools.some((p) => p.status === "AKTIF" && p.region_id === u.regionId && p.fupa_number.toLowerCase() === fupa.toLowerCase()))
    throw new HttpError(409, `Nomor FUPA "${fupa}" sudah dipakai pooling aktif lain.`);
  const chosen = ids.map((id) => allSubs.find((s) => s.submission_id === id));
  for (const [i, s] of chosen.entries()) {
    if (!s) throw new HttpError(404, `Pengajuan ${ids[i]} tidak ditemukan.`);
    assertScope(u, s.region_id);
    if (s.status !== STATUS.APPROVED) throw new HttpError(409, `${s.submission_id} berstatus "${s.status}"; hanya pengajuan Disetujui yang dapat di-pooling.`);
    if (items.some((it) => it.submission_id === s.submission_id && it.status === "AKTIF"))
      throw new HttpError(409, `${s.submission_id} sudah tergabung dalam pooling aktif.`);
  }
  const poolId = nextId("POOL", pools, "pooling_id");
  const t = nowIso();
  await store.insert("REGIONAL_POOLINGS", [
    { pooling_id: poolId, fupa_number: fupa, pooling_date: input.pooling_date, region_id: u.regionId, notes: (input.notes || "").trim(),
      status: "AKTIF", created_by: u.userId, created_at: t, cancelled_at: "", cancel_reason: "" },
  ]);
  await store.insert("REGIONAL_POOLING_ITEMS", chosen.map((s, i) => ({
    item_id: `PI-${Date.now().toString(36)}${i}`.toUpperCase(), pooling_id: poolId, submission_id: s!.submission_id, spbu_id: s!.spbu_id, status: "AKTIF", added_at: t,
  })));
  for (const s of chosen) await setStatus(u, s!.submission_id, STATUS.POOLED, `Masuk pooling ${poolId} (FUPA ${fupa})`);
  await logActivity(u, "BUAT_POOLING", "POOLING", poolId, `FUPA ${fupa}: ${ids.join(", ")}`);
  return poolId;
}

/** Pembatalan pooling tercatat (alasan wajib); pengajuan kembali ke "Disetujui". */
export async function cancelPooling(u: SessionUser, poolId: string, reason: string) {
  if (u.role !== "ADMIN_REGION") throw new HttpError(403, "Hanya PIC Region yang dapat membatalkan pooling.");
  const store = await getStore();
  const pool = (await store.list("REGIONAL_POOLINGS")).find((p) => p.pooling_id === poolId);
  if (!pool) throw new HttpError(404, "Pooling tidak ditemukan.");
  assertScope(u, pool.region_id);
  if (pool.status !== "AKTIF") throw new HttpError(409, "Pooling sudah dibatalkan.");
  if ((await store.list("MEMO_POOLING_ITEMS")).some((m) => m.pooling_id === poolId)) throw new HttpError(409, "Pooling sudah tercakup dalam MEMO dan tidak dapat dibatalkan.");
  if ((reason || "").trim().length < 5) throw new HttpError(400, "Alasan pembatalan wajib diisi.");
  await store.update("REGIONAL_POOLINGS", poolId, { status: "DIBATALKAN", cancelled_at: nowIso(), cancel_reason: reason.trim() });
  for (const it of (await store.list("REGIONAL_POOLING_ITEMS")).filter((i) => i.pooling_id === poolId && i.status === "AKTIF")) {
    await store.update("REGIONAL_POOLING_ITEMS", it.item_id, { status: "DIBATALKAN" });
    await setStatus(u, it.submission_id, STATUS.APPROVED, `Pooling ${poolId} dibatalkan: ${reason.trim()}`);
  }
  await logActivity(u, "BATAL_POOLING", "POOLING", poolId, reason);
}

/* ------------------------------------------------------------------- MEMO */
export async function listMemos(u: SessionUser): Promise<any[]> {
  const store = await getStore();
  let memos = await store.list("REGIONAL_MEMOS");
  if (u.role === "ADMIN_REGION") memos = memos.filter((m) => m.region_id === u.regionId);
  if (u.role === "ADMIN_SPBU") return [];
  const [mpi, pools, fwd, regions, items, spbus] = await Promise.all([
    store.list("MEMO_POOLING_ITEMS"), store.list("REGIONAL_POOLINGS"), store.list("MEMO_FORWARDING"), store.list("REGIONS"),
    store.list("REGIONAL_POOLING_ITEMS"), store.list("SPBUS"),
  ]);
  const sp = new Map(spbus.map((s) => [s.spbu_id, s.name]));
  return memos.map((m) => {
    const pids = mpi.filter((x) => x.memo_id === m.memo_id).map((x) => x.pooling_id);
    const subs = items.filter((i) => pids.includes(i.pooling_id) && i.status === "AKTIF")
      .map((i) => ({ submission_id: i.submission_id, spbu_name: sp.get(i.spbu_id) || i.spbu_id }));
    return {
      ...m, region_name: regions.find((r) => r.region_id === m.region_id)?.region_name || m.region_id,
      poolings: pids.map((id) => pools.find((p) => p.pooling_id === id)!).filter(Boolean),
      submissions: subs,
      forwarding: fwd.find((f) => f.memo_id === m.memo_id) || null,
    };
  }).sort((a: any, b: any) => b.memo_id.localeCompare(a.memo_id));
}

export async function listMemoablePoolings(u: SessionUser) {
  const store = await getStore();
  const used = new Set((await store.list("MEMO_POOLING_ITEMS")).map((m) => m.pooling_id));
  return (await listPoolings(u)).filter((p) => p.status === "AKTIF" && !used.has(p.pooling_id));
}

export async function createMemo(u: SessionUser, input: { memo_number: string; memo_date: string; pooling_ids: string[]; notes?: string }) {
  if (u.role !== "ADMIN_REGION") throw new HttpError(403, "Hanya PIC Region yang dapat mencatat MEMO.");
  const store = await getStore();
  const num = (input.memo_number || "").trim();
  if (num.length < 3) throw new HttpError(400, "Nomor MEMO wajib diisi.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.memo_date || "") || input.memo_date > today()) throw new HttpError(400, "Tanggal MEMO tidak valid.");
  const pids = [...new Set(input.pooling_ids || [])];
  if (!pids.length) throw new HttpError(400, "Pilih minimal satu FUPA Regional (pooling).");
  const [memos, pools, mpi, items] = await Promise.all([store.list("REGIONAL_MEMOS"), store.list("REGIONAL_POOLINGS"), store.list("MEMO_POOLING_ITEMS"), store.list("REGIONAL_POOLING_ITEMS")]);
  if (memos.some((m) => m.memo_number.toLowerCase() === num.toLowerCase())) throw new HttpError(409, `Nomor MEMO "${num}" sudah tercatat.`);
  for (const id of pids) {
    const p = pools.find((x) => x.pooling_id === id);
    if (!p) throw new HttpError(404, `Pooling ${id} tidak ditemukan.`);
    assertScope(u, p.region_id);
    if (p.status !== "AKTIF") throw new HttpError(409, `Pooling ${id} sudah dibatalkan.`);
    if (mpi.some((m) => m.pooling_id === id)) throw new HttpError(409, `Pooling ${id} sudah tercakup MEMO lain.`);
  }
  const memoId = nextId("MEMO", memos, "memo_id");
  const t = nowIso();
  await store.insert("REGIONAL_MEMOS", [{ memo_id: memoId, memo_number: num, memo_date: input.memo_date, region_id: u.regionId, notes: (input.notes || "").trim(), created_by: u.userId, created_at: t }]);
  await store.insert("MEMO_POOLING_ITEMS", pids.map((p, i) => ({ id: `MP-${Date.now().toString(36)}${i}`.toUpperCase(), memo_id: memoId, pooling_id: p })));
  await store.insert("MEMO_FORWARDING", [{ forwarding_id: `FWD-${memoId.split("-")[1]}`, memo_id: memoId, status: FORWARD.NO, forwarded_date: "", notes: "", updated_by: u.userId, updated_at: t }]);
  for (const id of pids)
    for (const it of items.filter((i) => i.pooling_id === id && i.status === "AKTIF"))
      await setStatus(u, it.submission_id, STATUS.MEMOED, `Tercakup dalam ${memoId} (${num})`);
  await logActivity(u, "CATAT_MEMO", "MEMO", memoId, `${num}: ${pids.join(", ")}`);
  return memoId;
}

export async function updateForwarding(u: SessionUser, memoId: string, input: { status: string; forwarded_date?: string; notes?: string }) {
  if (u.role !== "ADMIN_REGION") throw new HttpError(403, "Hanya PIC Region yang dapat mencatat penerusan MEMO.");
  const store = await getStore();
  const memo = (await store.list("REGIONAL_MEMOS")).find((m) => m.memo_id === memoId);
  if (!memo) throw new HttpError(404, "MEMO tidak ditemukan.");
  assertScope(u, memo.region_id);
  if (![FORWARD.NO, FORWARD.YES].includes(input.status as any)) throw new HttpError(400, "Status penerusan tidak valid.");
  if (input.status === FORWARD.YES && !/^\d{4}-\d{2}-\d{2}$/.test(input.forwarded_date || "")) throw new HttpError(400, "Tanggal penerusan wajib diisi.");
  const f = (await store.list("MEMO_FORWARDING")).find((x) => x.memo_id === memoId);
  const patch = { status: input.status, forwarded_date: input.status === FORWARD.YES ? input.forwarded_date! : "", notes: (input.notes || "").trim(), updated_by: u.userId, updated_at: nowIso() };
  if (f) await store.update("MEMO_FORWARDING", f.forwarding_id, patch);
  else await store.insert("MEMO_FORWARDING", [{ forwarding_id: `FWD-${memoId.split("-")[1]}`, memo_id: memoId, ...patch }]);
  await logActivity(u, "CATAT_PENERUSAN_PAM", "MEMO", memoId, `${input.status} ${patch.forwarded_date}`);
}

export { requireUser };
