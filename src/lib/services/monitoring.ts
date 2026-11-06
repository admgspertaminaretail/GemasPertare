import { getStore } from "../db";
import { SessionUser, HttpError } from "../auth";
import { STATUS, STATUS_LIST, FORWARD } from "../constants";
import { enrich, SubmissionView } from "./submissions";
import { assertScope } from "./core";

export interface DashFilters {
  year?: string;
  region?: string;
  spbu?: string;
  subId?: string;
  status?: string;
  fupa?: string;
  memo?: string;
}

const inReview = (s: string) => s === STATUS.UPLOADED || s === STATUS.REVIEW;

function counts(subs: SubmissionView[]) {
  return {
    total: subs.length,
    review: subs.filter((s) => inReview(s.status)).length,
    revision: subs.filter((s) => s.status === STATUS.REVISION).length,
    approved: subs.filter((s) => s.status === STATUS.APPROVED).length,
    pooled: subs.filter((s) => s.status === STATUS.POOLED).length,
    memoed: subs.filter((s) => s.status === STATUS.MEMOED).length,
  };
}

export async function getDashboard(u: SessionUser, f: DashFilters = {}) {
  const store = await getStore();
  const [regionsAll, spbusAll, subsRaw, pools, mpi, memos, fwd, docs] = await Promise.all([
    store.list("REGIONS"), store.list("SPBUS"), store.list("SUBMISSIONS"), store.list("REGIONAL_POOLINGS"),
    store.list("MEMO_POOLING_ITEMS"), store.list("REGIONAL_MEMOS"), store.list("MEMO_FORWARDING"),
    store.list("SUBMISSION_DOCUMENTS"),
  ]);
  void mpi;
  const poolMap = new Map(pools.map((p) => [p.pooling_id, p]));
  // Jumlah baris arsip dari Excel Daftar Arsip terkini tiap pengajuan
  const arsipMap = new Map<string, number>();
  for (const d of docs) {
    if (d.doc_type !== "EXCEL" || d.is_current !== "1") continue;
    let n = 0;
    try { n = Number(JSON.parse(d.meta || "{}").rows) || 0; } catch { n = 0; }
    arsipMap.set(d.submission_id, n);
  }
  const spbuMap = new Map(spbusAll.map((s) => [s.spbu_id, s]));
  const fwdMap = new Map(fwd.map((x) => [x.memo_id, x]));
  // Lingkup berdasarkan role (dipaksa di server, filter dari klien tidak bisa melewatinya)
  let regionFilter = f.region || "";
  let spbuFilter = f.spbu || "";
  if (u.role === "ADMIN_REGION") regionFilter = u.regionId;
  if (u.role === "ADMIN_SPBU") { regionFilter = u.regionId; spbuFilter = u.spbuId; }

  const spbus = spbusAll.filter((s) => s.is_active === "1" && (!regionFilter || s.region_id === regionFilter) && (!spbuFilter || s.spbu_id === spbuFilter));
  const spbuIds = new Set(spbus.map((s) => s.spbu_id));
  const regions = regionsAll.filter((r) => r.is_active === "1" && (!regionFilter || r.region_id === regionFilter));

  const years = [...new Set(subsRaw.map((s) => s.submission_date.slice(0, 4)))].sort().reverse();
  let subs = await enrich(subsRaw.filter((s) => spbuIds.has(s.spbu_id)));
  if (f.year) subs = subs.filter((s) => s.submission_date.startsWith(f.year!));
  if (f.subId) {
    const q = f.subId.trim().toLowerCase();
    subs = subs.filter((s) => s.submission_id.toLowerCase().includes(q));
  }
  if (f.status) subs = subs.filter((s) => s.status === f.status);
  if (f.fupa) subs = subs.filter((s) => s.fupa_number.toLowerCase().includes(f.fupa!.toLowerCase()));
  if (f.memo) subs = subs.filter((s) => s.memo_number.toLowerCase().includes(f.memo!.toLowerCase()));
  const filtered = !!(f.subId || f.status || f.fupa || f.memo);

  const submittedSpbu = new Set(subs.map((s) => s.spbu_id)); // SPBU unik, bukan jumlah transaksi
  const c = counts(subs);
  const kpi = {
    totalSpbu: filtered ? submittedSpbu.size : spbus.length,
    spbuSubmitted: submittedSpbu.size,
    spbuNotSubmitted: Math.max(0, spbus.length - submittedSpbu.size),
    spbuDone: new Set(subs.filter((x) => x.status === STATUS.MEMOED).map((x) => x.spbu_id)).size,
    ...c,
    // kumulatif (untuk grafik progres)
    approvedOrBeyond: c.approved + c.pooled + c.memoed,
    pooledOrBeyond: c.pooled + c.memoed,
  };

  const byRegion = regions.map((r) => {
    const rs = subs.filter((s) => s.region_id === r.region_id);
    const rsp = spbus.filter((s) => s.region_id === r.region_id);
    return {
      region_id: r.region_id, name: r.region_name, totalSpbu: rsp.length,
      spbuSubmitted: new Set(rs.map((s) => s.spbu_id)).size, ...counts(rs),
      // SPBU unik yang sudah selesai: punya minimal 1 pengajuan berstatus akhir "Sudah Di-Memo"
      spbuDone: new Set(rs.filter((x) => x.status === STATUS.MEMOED).map((x) => x.spbu_id)).size,
    };
  });

  const statusCounts = STATUS_LIST.map((s) => ({ status: s, count: subs.filter((x) => x.status === s).length }));

  const memoIds = new Set(subs.map((s) => s.memo_id).filter(Boolean));
  const memoRows = memos.filter((m) => memoIds.has(m.memo_id));
  const forwarded = memoRows.filter((m) => fwd.find((x) => x.memo_id === m.memo_id)?.status === FORWARD.YES).length;
  const memoProgress = {
    memoCount: memoRows.length,
    forwarded,
    notForwarded: memoRows.length - forwarded,
    pooledNotMemoed: c.pooled,
    memoed: c.memoed,
  };

  const cmpChrono = (a: SubmissionView, b: SubmissionView) =>
    a.submission_id.localeCompare(b.submission_id, "id", { numeric: true });

  const spbuRows = spbus
    .map((s) => {
      const ss = subs.filter((x) => x.spbu_id === s.spbu_id).sort((a, b) => cmpChrono(b, a));
      const ssAsc = [...ss].reverse();
      return {
        spbu_id: s.spbu_id, spbu_code: s.spbu_code, name: s.name,
        city: [s.city, s.province].filter(Boolean).join(", "),
        region_id: s.region_id,
        region_name: regions.find((r) => r.region_id === s.region_id)?.region_name || "",
        total: ss.length,
        submissionIds: ssAsc.map((x) => x.submission_id),
        submissionIdsText: ssAsc.map((x) => x.submission_id).join(", "),
        firstSubmissionId: ssAsc[0]?.submission_id || "",
        arsipTotal: ss.reduce((a, x) => a + (arsipMap.get(x.submission_id) || 0), 0),
        memoedCount: ss.filter((x) => x.status === STATUS.MEMOED).length,
        lastStatus: ss[0]?.status || "Belum mengajukan",
        lastDate: ss[0]?.submission_date || "",
        fupa: [...new Set(ssAsc.map((x) => x.fupa_number).filter(Boolean))].join(", "),
        memo: [...new Set(ssAsc.map((x) => x.memo_number).filter(Boolean))].join(", "),
        memoDate: ss.filter((x) => x.status === STATUS.MEMOED).map((x) => x.memo_date).filter(Boolean).sort().pop() || "",
      };
    })
    .filter((r) => !filtered || r.total > 0);

  // Daftar transaksi pengajuan terurut kronologis berdasarkan ID Pengajuan (SUB-0001 → seterusnya)
  const subRows = [...subs]
    .sort(cmpChrono)
    .map((s, idx) => {
      const sp = spbuMap.get(s.spbu_id);
      const pl = s.pooling_id ? poolMap.get(s.pooling_id) : undefined;
      const fw = s.memo_id ? fwdMap.get(s.memo_id) : undefined;
      return {
        chrono_no: idx + 1,
        submission_id: s.submission_id,
        revision_no: Number(s.current_revision || 0),
        current_revision: s.current_revision || "0",
        spbu_id: s.spbu_id, region_id: s.region_id, spbu_name: s.spbu_name, spbu_code: s.spbu_code,
        city: sp ? [sp.city, sp.province].filter(Boolean).join(", ") : "",
        region_name: s.region_name,
        status: s.status, submission_date: s.submission_date,
        updated_at: (s.updated_at || s.created_at || "").slice(0, 10),
        arsip: arsipMap.get(s.submission_id) || 0,
        description: s.description || "",
        fupa: s.fupa_number,
        pooling_date: pl?.pooling_date || "",
        memo: s.memo_number, memo_date: s.memo_date,
        forward: s.memo_id ? (fw?.status === FORWARD.YES ? FORWARD.YES : FORWARD.NO) : "",
        forwarded_date: fw?.status === FORWARD.YES ? (fw.forwarded_date || "") : "",
      };
    });

  const needAction = {
    review: subs.filter((s) => inReview(s.status)).slice(0, 8),
    revision: subs.filter((s) => s.status === STATUS.REVISION).slice(0, 8),
  };

  return {
    scope: u.role === "ADMIN_PAM" ? (regionFilter ? "REGION" : "HO") : u.role === "ADMIN_REGION" ? "REGION" : "SPBU",
    kpi, byRegion, statusCounts, memoProgress, spbuRows, subRows, years, needAction,
    regions: regionsAll.filter((r) => r.is_active === "1").filter((r) => u.role === "ADMIN_PAM" || r.region_id === u.regionId),
    spbuOptions: spbusAll.filter((s) => (u.role === "ADMIN_PAM" ? (!f.region || s.region_id === f.region) : s.region_id === u.regionId)).map((s) => ({ id: s.spbu_id, name: s.name })),
  };
}

export async function getSpbuDetail(u: SessionUser, spbuId: string) {
  const store = await getStore();
  const spbu = (await store.list("SPBUS")).find((s) => s.spbu_id === spbuId);
  if (!spbu) return null;
  try { assertScope(u, spbu.region_id, spbu.spbu_id); } catch { throw new HttpError(403, "Di luar lingkup akses."); }
  const region = (await store.list("REGIONS")).find((r) => r.region_id === spbu.region_id);
  const subs = (await enrich((await store.list("SUBMISSIONS")).filter((s) => s.spbu_id === spbuId))).sort((a, b) => b.submission_id.localeCompare(a.submission_id));
  return { spbu, region, subs, counts: counts(subs) };
}
