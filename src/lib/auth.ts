import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getStore } from "./db";
import { RoleId } from "./constants";
import type { Row } from "./schema";

export const COOKIE = "gemas_session";
const MAX_AGE = 60 * 60 * 8; // 8 jam

export const MAX_LOGIN_ATTEMPTS = 10;
export const SUSPEND_DURATION_MS = 15 * 60 * 1000; // Penangguhan 15 menit setelah 10 kali salah sandi
const ATTEMPT_WINDOW_MS = 30 * 60 * 1000; // Jendela akumulasi salah sandi 30 menit
export const SUPPORT_EMAIL = "adm.gs.pertaminaretail@gmail.com";

const GUARD_DIR = process.env.VERCEL ? "/tmp/gemas" : path.join(process.cwd(), "data");
const GUARD_FILE = path.join(GUARD_DIR, "login-guard.json");

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET (min. 32 karakter) belum di-set.");
    return new TextEncoder().encode("dev-only-secret-dev-only-secret-dev-only-1234");
  }
  return new TextEncoder().encode(s);
}

export interface SessionUser {
  userId: string;
  username: string;
  name: string;
  role: RoleId;
  regionId: string;
  spbuId: string;
  isDemo?: boolean;
}

export async function createSession(u: SessionUser) {
  const token = await new SignJWT({ ...u })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE });
}

export function destroySession() {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Membaca sesi dari cookie lalu memverifikasi ulang user ke database (akun nonaktif langsung ditolak). */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const store = await getStore();
    const u = (await store.list("USERS")).find((x) => x.user_id === payload.userId);
    if (!u || u.is_active !== "1") return null;
    return {
      userId: u.user_id, username: u.username, name: u.full_name, role: u.role_id as RoleId,
      regionId: u.region_id, spbuId: u.spbu_id, isDemo: u.is_demo === "1",
    };
  } catch {
    return null;
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(roles?: RoleId[]): Promise<SessionUser> {
  const u = await getSession();
  if (!u) throw new HttpError(401, "Sesi berakhir. Silakan login kembali.");
  if (roles && !roles.includes(u.role)) throw new HttpError(403, "Anda tidak memiliki hak akses untuk tindakan ini.");
  return u;
}

export const hashPassword = (p: string) => bcrypt.hashSync(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compareSync(p, h);

/* ---------------- Proteksi 10x Percobaan Kata Sandi Salah ---------------- */
interface GuardRecord {
  attempts: number;
  windowUntil: number;
  suspendedUntil: number;
}

const g = globalThis as unknown as { __gemasLoginGuard?: Map<string, GuardRecord> };

function getGuardMap(): Map<string, GuardRecord> {
  if (!g.__gemasLoginGuard) {
    const m = new Map<string, GuardRecord>();
    try {
      if (fs.existsSync(GUARD_FILE)) {
        const raw = JSON.parse(fs.readFileSync(GUARD_FILE, "utf8")) as Record<string, GuardRecord>;
        for (const [k, v] of Object.entries(raw)) m.set(k, v);
      }
    } catch { /* abaikan */ }
    g.__gemasLoginGuard = m;
  }
  return g.__gemasLoginGuard;
}

function persistGuardMap() {
  try {
    const m = getGuardMap();
    const now = Date.now();
    const obj: Record<string, GuardRecord> = {};
    for (const [k, v] of m.entries()) {
      if (v.suspendedUntil > now || v.windowUntil > now) obj[k] = v;
    }
    fs.mkdirSync(GUARD_DIR, { recursive: true });
    fs.writeFileSync(GUARD_FILE, JSON.stringify(obj, null, 2));
  } catch { /* abaikan jika read-only */ }
}

export function checkLoginSuspension(username: string) {
  const key = username.trim().toLowerCase();
  const map = getGuardMap();
  const rec = map.get(key);
  const now = Date.now();
  if (!rec) return { suspended: false, waitSeconds: 0, attempts: 0, maxAttempts: MAX_LOGIN_ATTEMPTS };
  if (rec.suspendedUntil > now) {
    return {
      suspended: true,
      waitSeconds: Math.ceil((rec.suspendedUntil - now) / 1000),
      attempts: MAX_LOGIN_ATTEMPTS,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
    };
  }
  if (rec.suspendedUntil > 0 && rec.suspendedUntil <= now) {
    map.delete(key);
    persistGuardMap();
    return { suspended: false, waitSeconds: 0, attempts: 0, maxAttempts: MAX_LOGIN_ATTEMPTS };
  }
  if (rec.windowUntil <= now) {
    map.delete(key);
    persistGuardMap();
    return { suspended: false, waitSeconds: 0, attempts: 0, maxAttempts: MAX_LOGIN_ATTEMPTS };
  }
  return { suspended: false, waitSeconds: 0, attempts: rec.attempts, maxAttempts: MAX_LOGIN_ATTEMPTS };
}

export function recordWrongPassword(username: string) {
  const key = username.trim().toLowerCase();
  const map = getGuardMap();
  const cur = checkLoginSuspension(key);
  if (cur.suspended) {
    return {
      suspended: true,
      attempts: MAX_LOGIN_ATTEMPTS,
      remaining: 0,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      waitSeconds: cur.waitSeconds,
    };
  }
  const now = Date.now();
  const nextAttempts = cur.attempts + 1;
  if (nextAttempts >= MAX_LOGIN_ATTEMPTS) {
    const suspendedUntil = now + SUSPEND_DURATION_MS;
    map.set(key, { attempts: MAX_LOGIN_ATTEMPTS, windowUntil: suspendedUntil, suspendedUntil });
    persistGuardMap();
    return {
      suspended: true,
      attempts: MAX_LOGIN_ATTEMPTS,
      remaining: 0,
      maxAttempts: MAX_LOGIN_ATTEMPTS,
      waitSeconds: Math.ceil(SUSPEND_DURATION_MS / 1000),
    };
  }
  map.set(key, { attempts: nextAttempts, windowUntil: now + ATTEMPT_WINDOW_MS, suspendedUntil: 0 });
  persistGuardMap();
  return {
    suspended: false,
    attempts: nextAttempts,
    remaining: MAX_LOGIN_ATTEMPTS - nextAttempts,
    maxAttempts: MAX_LOGIN_ATTEMPTS,
    waitSeconds: 0,
  };
}

export function clearLoginGuard(username: string) {
  const key = username.trim().toLowerCase();
  const map = getGuardMap();
  if (map.delete(key)) persistGuardMap();
}

// Kompatibilitas mundur
export const loginThrottle = (key: string) => checkLoginSuspension(key.split("|")[0]).waitSeconds;
export const loginFailed = (key: string) => recordWrongPassword(key.split("|")[0]);
export const loginOk = (key: string) => clearLoginGuard(key.split("|")[0]);

/* ---------------- Koreksi & Rekomendasi Username Pintar ------------------ */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

const ROMAN_MAP: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8" };

export interface UsernameSuggestion {
  username: string;
  label: string;
}

export function suggestUsernames(rawInput: string, users: Row[], spbus: Row[] = []): UsernameSuggestion[] {
  const fullQ = rawInput.trim().toLowerCase();
  if (!fullQ) return [];
  const q = fullQ.includes("@") ? fullQ.split("@")[0] : fullQ;
  const qClean = q.replace(/[^a-z0-9]/g, "");
  const qDigits = q.replace(/\D+/g, "");
  const spbuMap = new Map(spbus.map((s) => [s.spbu_id, s]));

  // Deteksi penulisan singkat Region (misal "reg1", "region 2", "region ii")
  const regMatch = q.match(/^(?:pic[\s._-]*)?reg(?:ion)?[\s._-]*([1-9]|i{1,3}|iv|vi{0,3})$/);
  const wantedRegNum = regMatch ? (ROMAN_MAP[regMatch[1]] || regMatch[1]) : "";

  const scored: { score: number; username: string; label: string }[] = [];

  for (const u of users) {
    if (u.is_active !== "1") continue;
    const uname = u.username.toLowerCase();
    const uClean = uname.replace(/[^a-z0-9]/g, "");
    const uDigits = uname.replace(/\D+/g, "");
    const spbu = u.spbu_id ? spbuMap.get(u.spbu_id) : undefined;
    const spbuCodeDigits = spbu ? spbu.spbu_code.replace(/\D+/g, "") : "";
    const label = spbu ? `${u.full_name} (${spbu.spbu_code})` : u.full_name;

    let score = 0;

    if (qClean && qClean === uClean) {
      score = 100;
    } else if (qDigits.length >= 4 && (uDigits === qDigits || spbuCodeDigits === qDigits)) {
      score = 98;
    } else if (wantedRegNum && u.role_id === "ADMIN_REGION" && u.region_id === `REG-${wantedRegNum}`) {
      score = 96;
    } else if ((q === "pam" || q === "admin" || q.includes("pam") || q.includes("pusat")) && u.role_id === "ADMIN_PAM") {
      score = 94;
    } else if (uname.startsWith(q) || (q.length >= 3 && q.startsWith(uname))) {
      score = 88 - Math.min(10, Math.abs(uname.length - q.length));
    } else if (qClean.length >= 3 && (uClean.includes(qClean) || qClean.includes(uClean))) {
      score = 82 - Math.min(12, Math.abs(uClean.length - qClean.length));
    } else if (qDigits.length >= 4 && (uDigits.includes(qDigits) || spbuCodeDigits.includes(qDigits))) {
      score = 80;
    }

    // Jarak ketik Levenshtein untuk typo (cth: "pam.dmeo" -> "pam.demo", "regon1.demo" -> "region1.demo")
    if (score < 85 && Math.abs(uname.length - q.length) <= 4) {
      const dist = Math.min(levenshtein(q, uname), qClean && uClean ? levenshtein(qClean, uClean) : 99);
      const maxLen = Math.max(q.length, uname.length, 1);
      const sim = 1 - dist / maxLen;
      if (dist <= 2 || sim >= 0.62) {
        score = Math.max(score, Math.round(60 + sim * 34));
      }
    }

    // Pencarian berdasarkan nama pengguna / nama SPBU / kota SPBU (cth: "dago", "abdul muis", "medan")
    if (score < 75 && q.length >= 3) {
      const haystack = `${u.full_name} ${spbu?.name || ""} ${spbu?.city || ""} ${spbu?.spbu_code || ""}`.toLowerCase();
      if (haystack.includes(q)) {
        score = Math.max(score, 74);
      }
    }

    if (score >= 58) {
      scored.push({ score, username: u.username, label });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .slice(0, 4)
    .map(({ username, label }) => ({ username, label }));
}

export const randomId = (n = 6) => crypto.randomBytes(n).toString("hex");
