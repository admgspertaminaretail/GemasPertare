import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getStore } from "./db";
import { RoleId } from "./constants";

export const COOKIE = "gemas_session";
const MAX_AGE = 60 * 60 * 8; // 8 jam

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

/* Pembatasan percobaan login (in-memory, per instance). */
const attempts = new Map<string, { n: number; until: number }>();
export function loginThrottle(key: string) {
  const a = attempts.get(key);
  return a && a.until > Date.now() && a.n >= 5 ? Math.ceil((a.until - Date.now()) / 1000) : 0;
}
export function loginFailed(key: string) {
  const a = attempts.get(key);
  attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 5 * 60_000 });
}
export function loginOk(key: string) {
  attempts.delete(key);
}
export const randomId = (n = 6) => crypto.randomBytes(n).toString("hex");
