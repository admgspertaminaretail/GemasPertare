import { getStore } from "../db";
import { SessionUser, HttpError } from "../auth";
import { STATUS, STATUS_LIST, FORWARD } from "../constants";
import { enrich, SubmissionView } from "./submissions";
import { assertScope } from "./core";

export interface DashFilters {
  year?: string;
  region?: string;
  spbu?: string;
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
  const [regionsAll, spbusAll, subsRaw, mpi, memos, fwd] = await Promise.all([
    store.list("REGIONS"), store.list("SPBUS"), store.list("SUBMISSIONS"),
    store.list("MEMO_POOLING_ITEMS"), store.list("REGIONAL_MEMOS"), store.list("MEMO_FORWARDING"),
  ]);
  void mpi;
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
  if (f.status) subs = subs.filter((s) => s.status === f.status);
  if (f.fupa) subs = subs.filter((s) => s.fupa_number.toLowerCase().includes(f.fupa!.toLowerCase()));
  if (f.memo) subs = subs.filter((s) => s.memo_number.toLowerCase().includes(f.memo!.toLowerCase()));
  const filtered = !!(f.status || f.fupa || f.memo);

  const submittedSpbu = new Set(subs.map((s) => s.spbu_id)); // SPBU unik, bukan jumlah transaksi
  const c = counts(subs);
  const kpi = {
    totalSpbu: filtered ? submittedSpbu.size : spbus.length,
    spbuSubmitted: submittedSpbu.size,
    spbuNotSubmitted: Math.max(0, spbus.length - submittedSpbu.size),
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

  const spbuRows = spbus
    .map((s) => {
      const ss = subs.filter((x) => x.spbu_id === s.spbu_id).sort((a, b) => b.submission_id.localeCompare(a.submission_id));
      return {
        spbu_id: s.spbu_id, spbu_code: s.spbu_code, name: s.name, region_id: s.region_id,
        region_name: regions.find((r) => r.region_id === s.region_id)?.region_name || "",
        total: ss.length,
        lastStatus: ss[0]?.status || "Belum mengajukan",
        lastDate: ss[0]?.submission_date || "",
        fupa: [...new Set(ss.map((x) => x.fupa_number).filter(Boolean))].join(", "),
        memo: [...new Set(ss.map((x) => x.memo_number).filter(Boolean))].join(", "),
      };
    })
    .filter((r) => !filtered || r.total > 0);

  const needAction = {
    review: subs.filter((s) => inReview(s.status)).slice(0, 8),
    revision: subs.filter((s) => s.status === STATUS.REVISION).slice(0, 8),
  };

  return {
    scope: u.role === "ADMIN_PAM" ? (regionFilter ? "REGION" : "HO") : u.role === "ADMIN_REGION" ? "REGION" : "SPBU",
    kpi, byRegion, statusCounts, memoProgress, spbuRows, years, needAction,
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
