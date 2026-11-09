import ExcelJS from "exceljs";
import { getStore } from "../db";
import { SessionUser, HttpError, hashPassword, verifyPassword, clearLoginGuard } from "../auth";
import { Row } from "../schema";
import { logActivity, nowIso, nextId } from "./core";
import { validateUpload } from "../storage";

const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10" };
const must = (u: SessionUser) => { if (u.role !== "ADMIN_PAM") throw new HttpError(403, "Hanya Admin PAM yang dapat mengelola master data."); };

export async function listSpbus(u: SessionUser) {
  const store = await getStore();
  let rows = await store.list("SPBUS");
  if (u.role === "ADMIN_REGION") rows = rows.filter((s) => s.region_id === u.regionId);
  if (u.role === "ADMIN_SPBU") rows = rows.filter((s) => s.spbu_id === u.spbuId);
  const regions = new Map((await store.list("REGIONS")).map((r) => [r.region_id, r.region_name]));
  return rows.map((s) => ({ ...s, region_name: regions.get(s.region_id) || s.region_id }));
}

export async function saveSpbu(u: SessionUser, input: Partial<Row>, editId?: string) {
  must(u);
  const store = await getStore();
  const spbus = await store.list("SPBUS");
  const id = (input.spbu_id || "").trim(), code = (input.spbu_code || "").trim(), name = (input.name || "").trim();
  if (!/^\d{5,10}$/.test(editId || id)) throw new HttpError(400, "ID SPBU (Station ID) harus berupa angka 5-10 digit.");
  if (!code) throw new HttpError(400, "Kode SPBU (Station No) wajib diisi.");
  if (name.length < 3) throw new HttpError(400, "Nama SPBU wajib diisi.");
  if (!(await store.list("REGIONS")).some((r) => r.region_id === input.region_id)) throw new HttpError(400, "Region tidak valid.");
  const dupCode = spbus.find((s) => s.spbu_code.toLowerCase() === code.toLowerCase() && s.spbu_id !== (editId || id));
  if (dupCode) throw new HttpError(409, `Kode SPBU ${code} sudah dipakai ${dupCode.name}.`);
  const data = { spbu_code: code, name, region_id: input.region_id!, province: (input.province || "").trim(), city: (input.city || "").trim(), address: (input.address || "").trim(), pic_name: (input.pic_name || "").trim() };
  if (editId) {
    if (!spbus.some((s) => s.spbu_id === editId)) throw new HttpError(404, "SPBU tidak ditemukan.");
    await store.update("SPBUS", editId, data);
    await logActivity(u, "UBAH_MASTER_SPBU", "SPBU", editId, name);
  } else {
    if (spbus.some((s) => s.spbu_id === id)) throw new HttpError(409, `ID SPBU ${id} sudah terdaftar.`);
    await store.insert("SPBUS", [{ spbu_id: id, ...data, is_active: "1", created_at: nowIso() }]);
    await logActivity(u, "TAMBAH_MASTER_SPBU", "SPBU", id, name);
  }
}

export async function toggleSpbu(u: SessionUser, id: string, active: boolean) {
  must(u);
  const store = await getStore();
  if (!(await store.list("SPBUS")).some((s) => s.spbu_id === id)) throw new HttpError(404, "SPBU tidak ditemukan.");
  await store.update("SPBUS", id, { is_active: active ? "1" : "0" });
  await logActivity(u, active ? "AKTIFKAN_SPBU" : "NONAKTIFKAN_SPBU", "SPBU", id);
}

export async function saveRegion(u: SessionUser, input: { region_id?: string; region_name: string; is_active?: string }, editId?: string) {
  must(u);
  const store = await getStore();
  const regions = await store.list("REGIONS");
  const name = (input.region_name || "").trim();
  if (name.length < 3) throw new HttpError(400, "Nama Region wajib diisi.");
  if (regions.some((r) => r.region_name.toLowerCase() === name.toLowerCase() && r.region_id !== editId)) throw new HttpError(409, "Nama Region sudah ada.");
  if (editId) { await store.update("REGIONS", editId, { region_name: name, is_active: input.is_active ?? "1" }); await logActivity(u, "UBAH_REGION", "REGION", editId, name); return; }
  const id = `REG-${regions.length + 1 + Math.floor(Math.random() * 0)}`;
  const finalId = regions.some((r) => r.region_id === id) ? `REG-${Date.now().toString(36)}` : id;
  await store.insert("REGIONS", [{ region_id: finalId, region_name: name, is_active: "1" }]);
  await logActivity(u, "TAMBAH_REGION", "REGION", finalId, name);
}

/** Import Excel master SPBU. Kolom: Station No, Station ID, Region, Station Name, Provinsi, Kota/Kabupaten, Address. */
export async function importSpbuExcel(u: SessionUser, file: File | null) {
  must(u);
  const f = await validateUpload(file, "excel", "File Excel master SPBU");
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(f.buffer as any); } catch { throw new HttpError(400, "File Excel tidak dapat dibaca."); }
  const ws = wb.worksheets[0];
  const cell = (v: any) => (v && typeof v === "object" ? (v.text ?? v.result ?? "") : v ?? "").toString().trim();
  let headerRow = 0; const col: Record<string, number> = {};
  ws.eachRow((row, n) => {
    if (headerRow) return;
    const vals = (row.values as any[]).map((v) => cell(v).toLowerCase());
    if (vals.includes("station id")) {
      headerRow = n;
      vals.forEach((v, i) => { if (v) col[v] = i; });
    }
  });
  if (!headerRow) throw new HttpError(400, 'Header tidak ditemukan. Pastikan ada kolom "Station ID", "Station No", "Region", "Station Name".');
  for (const need of ["station id", "station no", "region", "station name"]) if (!col[need]) throw new HttpError(400, `Kolom "${need}" tidak ditemukan.`);

  const store = await getStore();
  const [spbus, regions] = await Promise.all([store.list("SPBUS"), store.list("REGIONS")]);
  const ids = new Set(spbus.map((s) => s.spbu_id));
  const codes = new Set(spbus.map((s) => s.spbu_code.toLowerCase()));
  const regionMap = new Map(regions.map((r) => [r.region_name.toLowerCase().replace("region ", "").trim(), r.region_id]));
  const report = { added: 0, duplicates: [] as string[], errors: [] as string[], newRegions: [] as string[] };
  const toAdd: Row[] = [];
  const newRegions: Row[] = [];
  ws.eachRow((row, n) => {
    if (n <= headerRow) return;
    const g = (k: string) => (col[k] ? cell(row.getCell(col[k]).value) : "");
    const id = g("station id").replace(/\D/g, ""), code = g("station no"), name = g("station name"), regRaw = g("region");
    if (!id && !name && !code) return;
    if (!id || !code || !name || !regRaw) { report.errors.push(`Baris ${n}: data wajib tidak lengkap.`); return; }
    if (ids.has(id) || codes.has(code.toLowerCase())) { report.duplicates.push(`${code} ${name} (baris ${n})`); return; }
    const key = regRaw.toUpperCase().replace("REGION", "").trim();
    const norm = (ROMAN[key] ? key : key).toLowerCase();
    let rid = regionMap.get(norm.toLowerCase()) || regionMap.get(key.toLowerCase());
    if (!rid) {
      rid = `REG-${ROMAN[key] || key}`;
      regionMap.set(key.toLowerCase(), rid);
      newRegions.push({ region_id: rid, region_name: `Region ${key}`, is_active: "1" });
      report.newRegions.push(`Region ${key}`);
    }
    ids.add(id); codes.add(code.toLowerCase());
    toAdd.push({ spbu_id: id, spbu_code: code, name, region_id: rid, province: g("provinsi"), city: g("kota/kabupaten"), address: g("address"), pic_name: "", is_active: "1", created_at: nowIso() });
  });
  if (newRegions.length) await store.insert("REGIONS", newRegions);
  if (toAdd.length) await store.insert("SPBUS", toAdd);
  report.added = toAdd.length;
  await logActivity(u, "IMPORT_MASTER_SPBU", "SPBU", "-", `Tambah ${report.added}, duplikat ${report.duplicates.length}, error ${report.errors.length}`);
  return report;
}

/* ---------------------------------------------------------------- pengguna */
export async function listUsers(u: SessionUser) {
  must(u);
  const store = await getStore();
  const [users, regions, spbus] = await Promise.all([store.list("USERS"), store.list("REGIONS"), store.list("SPBUS")]);
  return users.map(({ password_hash, ...x }) => {
    void password_hash;
    return { ...x, region_name: regions.find((r) => r.region_id === x.region_id)?.region_name || "", spbu_name: spbus.find((s) => s.spbu_id === x.spbu_id)?.name || "" };
  });
}

function validPassword(p: string) {
  if (p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p)) throw new HttpError(400, "Kata sandi minimal 8 karakter dan mengandung huruf serta angka.");
}

export async function saveUser(u: SessionUser, input: Partial<Row> & { password?: string }, editId?: string) {
  must(u);
  const store = await getStore();
  const users = await store.list("USERS");
  const username = (input.username || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, "Username 3-40 karakter (huruf kecil, angka, titik, strip).");
  if (users.some((x) => x.username === username && x.user_id !== editId)) throw new HttpError(409, "Username sudah dipakai.");
  if ((input.full_name || "").trim().length < 3) throw new HttpError(400, "Nama lengkap wajib diisi.");
  const role = input.role_id;
  if (!["ADMIN_SPBU", "ADMIN_REGION", "ADMIN_PAM"].includes(role || "")) throw new HttpError(400, "Role tidak valid.");
  const spbus = await store.list("SPBUS");
  let region = "", spbu = "";
  if (role === "ADMIN_SPBU") {
    const s = spbus.find((x) => x.spbu_id === input.spbu_id);
    if (!s) throw new HttpError(400, "Admin SPBU harus dikaitkan dengan satu SPBU.");
    spbu = s.spbu_id; region = s.region_id;
    if (users.some((x) => x.role_id === "ADMIN_SPBU" && x.spbu_id === spbu && x.is_active === "1" && x.user_id !== editId))
      throw new HttpError(409, "SPBU ini sudah memiliki satu akun Admin SPBU aktif.");
  }
  if (role === "ADMIN_REGION") {
    if (!(await store.list("REGIONS")).some((r) => r.region_id === input.region_id)) throw new HttpError(400, "PIC Region harus dikaitkan dengan satu Region.");
    region = input.region_id!;
  }
  const data = { username, full_name: input.full_name!.trim(), email: (input.email || "").trim(), role_id: role!, region_id: region, spbu_id: spbu };
  if (editId) {
    if (!users.some((x) => x.user_id === editId)) throw new HttpError(404, "Pengguna tidak ditemukan.");
    const patch: Partial<Row> = { ...data };
    if (input.password) {
      validPassword(input.password);
      patch.password_hash = hashPassword(input.password);
      clearLoginGuard(username);
    }
    await store.update("USERS", editId, patch);
    await logActivity(u, "UBAH_PENGGUNA", "USER", editId, username);
  } else {
    validPassword(input.password || "");
    const id = nextId("U", users, "user_id");
    await store.insert("USERS", [{ user_id: id, ...data, password_hash: hashPassword(input.password!), is_active: "1", is_demo: "0", created_at: nowIso(), last_login: "" }]);
    await logActivity(u, "TAMBAH_PENGGUNA", "USER", id, username);
  }
}

export async function toggleUser(u: SessionUser, id: string, active: boolean) {
  must(u);
  if (id === u.userId && !active) throw new HttpError(400, "Anda tidak dapat menonaktifkan akun sendiri.");
  const store = await getStore();
  const target = (await store.list("USERS")).find((x) => x.user_id === id);
  if (!target) throw new HttpError(404, "Pengguna tidak ditemukan.");
  await store.update("USERS", id, { is_active: active ? "1" : "0" });
  if (active) clearLoginGuard(target.username);
  await logActivity(u, active ? "AKTIFKAN_PENGGUNA" : "NONAKTIFKAN_PENGGUNA", "USER", id);
}

export async function changeOwnPassword(u: SessionUser, current: string, next: string) {
  const store = await getStore();
  const me = (await store.list("USERS")).find((x) => x.user_id === u.userId);
  if (!me || !verifyPassword(current, me.password_hash)) throw new HttpError(400, "Kata sandi saat ini salah.");
  validPassword(next);
  await store.update("USERS", u.userId, { password_hash: hashPassword(next) });
  await logActivity(u, "UBAH_KATA_SANDI", "USER", u.userId);
}

export async function updateOwnProfile(
  u: SessionUser,
  input: { profile_name?: string; employee_id?: string; phone?: string }
) {
  const profileName = (input.profile_name || "").trim();
  const employeeId = (input.employee_id || "").trim();
  const phone = (input.phone || "").trim();
  if (profileName.length < 2) throw new HttpError(400, "Nama lengkap wajib diisi (minimal 2 karakter).");
  if (employeeId.length < 2) throw new HttpError(400, "Nomor pegawai wajib diisi.");
  if (!/^[0-9+\-\s()]{7,22}$/.test(phone)) {
    throw new HttpError(400, "Nomor telepon tidak valid (gunakan angka, minimal 7 digit).");
  }
  const store = await getStore();
  const me = (await store.list("USERS")).find((x) => x.user_id === u.userId);
  if (!me) throw new HttpError(404, "Akun pengguna tidak ditemukan.");
  await store.update("USERS", u.userId, {
    profile_name: profileName,
    employee_id: employeeId,
    phone,
  });
  await logActivity(
    { ...u, name: profileName },
    "UPDATE_PROFIL_PEGAWAI",
    "USER",
    u.userId,
    `${profileName} · Nopek: ${employeeId} · Telp: ${phone}`
  );
  return { profile_name: profileName, employee_id: employeeId, phone };
}

/* ------------------------------------------------------------- audit trail */
export async function listActivity(u: SessionUser) {
  if (u.role !== "ADMIN_PAM") throw new HttpError(403, "Akses audit trail khusus untuk Admin GS / PAM.");
  const store = await getStore();
  const logs = await store.list("ACTIVITY_LOGS");
  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 2000);
}
