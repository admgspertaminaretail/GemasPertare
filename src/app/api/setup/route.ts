import { handle, jsonBody, ok } from "@/lib/api";
import { HttpError, hashPassword } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { SheetsStore } from "@/lib/store";
import { buildSeed } from "@/lib/seed";
import { nowIso } from "@/lib/services/core";
import crypto from "crypto";

/**
 * Bootstrap sekali pakai untuk Google Sheets: membuat 18 tab + header, mengisi ROLES/REGIONS/SPBUS (dari Excel perusahaan)
 * dan membuat Admin PAM pertama. Dinonaktifkan otomatis setelah ada pengguna. Wajib mengirim SETUP_KEY.
 */
export async function POST(req: Request) {
  return handle(async () => {
    if ((process.env.DB_DRIVER || "local") !== "sheets") throw new HttpError(400, "Setup hanya untuk DB_DRIVER=sheets.");
    const expected = process.env.SETUP_KEY || "";
    const b = await jsonBody<{ key: string; username: string; password: string; name: string }>(req);
    const a = Buffer.from(String(b.key || "")), e = Buffer.from(expected);
    if (!expected || a.length !== e.length || !crypto.timingSafeEqual(a, e)) throw new HttpError(403, "Kunci setup salah.");
    const store = (await getStore()) as SheetsStore;
    await store.ensureSchema();
    if ((await store.list("USERS")).length) throw new HttpError(409, "Setup sudah dilakukan (pengguna sudah ada).");
    if (!b.username || !b.name || !b.password || b.password.length < 8) throw new HttpError(400, "Lengkapi username, nama, dan kata sandi (min. 8 karakter).");
    const seed = await buildSeed({ demo: false });
    await store.insert("ROLES", seed.ROLES);
    await store.insert("REGIONS", seed.REGIONS);
    for (let i = 0; i < seed.SPBUS.length; i += 200) await store.insert("SPBUS", seed.SPBUS.slice(i, i + 200));
    await store.insert("KNOWLEDGE_DOCUMENTS", seed.KNOWLEDGE_DOCUMENTS);
    await store.insert("USERS", [{ user_id: "U-001", username: b.username.toLowerCase(), full_name: b.name, email: "", password_hash: hashPassword(b.password), role_id: "ADMIN_PAM", region_id: "", spbu_id: "", is_active: "1", is_demo: "0", created_at: nowIso(), last_login: "" }]);
    return ok({ message: "Setup selesai. Silakan login." });
  });
}
