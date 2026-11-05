import { handle, jsonBody, ok } from "@/lib/api";
import { createSession, HttpError, loginFailed, loginOk, loginThrottle, verifyPassword } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { logActivity, nowIso } from "@/lib/services/core";

export async function POST(req: Request) {
  return handle(async () => {
    const { username, password } = await jsonBody<{ username: string; password: string }>(req);
    const uname = String(username || "").trim().toLowerCase();
    const key = `${uname}|${req.headers.get("x-forwarded-for") || "local"}`;
    const wait = loginThrottle(key);
    if (wait) throw new HttpError(429, `Terlalu banyak percobaan. Coba lagi dalam ${wait} detik.`);
    const store = await getStore();
    const u = (await store.list("USERS")).find((x) => x.username === uname);
    if (!u || u.is_active !== "1" || !verifyPassword(String(password || ""), u.password_hash)) {
      loginFailed(key);
      throw new HttpError(401, "Username atau kata sandi salah.");
    }
    loginOk(key);
    await store.update("USERS", u.user_id, { last_login: nowIso() });
    const s = { userId: u.user_id, username: u.username, name: u.full_name, role: u.role_id as any, regionId: u.region_id, spbuId: u.spbu_id };
    await createSession(s);
    await logActivity(s, "LOGIN", "USER", u.user_id, "Login berhasil");
    return ok();
  });
}
