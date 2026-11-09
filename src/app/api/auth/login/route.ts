import { NextResponse } from "next/server";
import { handle, jsonBody, ok } from "@/lib/api";
import {
  checkLoginSuspension,
  clearLoginGuard,
  createSession,
  MAX_LOGIN_ATTEMPTS,
  recordWrongPassword,
  suggestUsernames,
  SUPPORT_EMAIL,
  verifyPassword,
} from "@/lib/auth";
import { getStore } from "@/lib/db";
import { logActivity, nowIso } from "@/lib/services/core";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await jsonBody<{ action?: string; username?: string; password?: string }>(req);
    const uname = String(body.username || "").trim().toLowerCase();

    const store = await getStore();
    const [users, spbus] = await Promise.all([store.list("USERS"), store.list("SPBUS")]);
    const cleanUname = uname.replace(/[^a-z0-9]/g, "");
    const u = users.find(
      (x) =>
        x.username.toLowerCase() === uname ||
        (x.email && x.email.toLowerCase() === uname) ||
        (x.role_id === "ADMIN_SPBU" && (
          x.spbu_id.toLowerCase() === cleanUname ||
          x.username.toLowerCase() === `spbu${cleanUname}`
        ))
    );

    // Pengecekan ringan keberadaan username & saran koreksi otomatis
    if (body.action === "check_username") {
      if (!uname) return ok({ exists: false, suggestions: [] });
      if (!u) {
        return ok({
          exists: false,
          enteredUsername: uname,
          suggestions: suggestUsernames(uname, users, spbus),
        });
      }
      if (u.is_active !== "1") {
        return ok({ exists: false, inactive: true, suggestions: [] });
      }
      const guard = checkLoginSuspension(u.username);
      return ok({
        exists: true,
        username: u.username,
        fullName: u.full_name,
        suspended: guard.suspended,
        waitSeconds: guard.waitSeconds,
        attempts: guard.attempts,
        maxAttempts: guard.maxAttempts,
      });
    }

    if (!uname) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: "Username wajib diisi." },
        { status: 400 }
      );
    }

    // 1. Jika username tidak terdaftar di data sistem → berikan rekomendasi koreksi username
    if (!u) {
      const suggestions = suggestUsernames(uname, users, spbus);
      return NextResponse.json(
        {
          code: "USER_NOT_FOUND",
          enteredUsername: uname,
          suggestions,
          error: `Username "${uname}" tidak terdaftar dalam data pengguna GEMAS.`,
        },
        { status: 404 }
      );
    }

    // 2. Akun dinonaktifkan oleh Admin PAM
    if (u.is_active !== "1") {
      return NextResponse.json(
        {
          code: "USER_INACTIVE",
          contactEmail: SUPPORT_EMAIL,
          error: `Akun "${u.username}" sedang berstatus nonaktif. Hubungi Admin GS (${SUPPORT_EMAIL}).`,
        },
        { status: 403 }
      );
    }

    // 3. Cek apakah akun sedang ditangguhkan (suspended) akibat 10x salah kata sandi
    const guardBefore = checkLoginSuspension(u.username);
    if (guardBefore.suspended) {
      return NextResponse.json(
        {
          code: "SUSPENDED",
          username: u.username,
          attempts: guardBefore.attempts,
          maxAttempts: guardBefore.maxAttempts,
          waitSeconds: guardBefore.waitSeconds,
          contactEmail: SUPPORT_EMAIL,
          error: `Akses login akun "${u.username}" ditangguhkan sementara karena telah gagal memasukkan kata sandi sebanyak ${MAX_LOGIN_ATTEMPTS} kali.`,
        },
        { status: 423 }
      );
    }

    const pwd = String(body.password || "");
    if (!pwd) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: "Kata sandi wajib diisi." },
        { status: 400 }
      );
    }

    // 4. Verifikasi kata sandi; catat kegagalan hingga batas 10 percobaan
    if (!verifyPassword(pwd, u.password_hash)) {
      const guardAfter = recordWrongPassword(u.username);
      if (guardAfter.suspended) {
        await logActivity(
          { userId: u.user_id, name: u.full_name, role: u.role_id as any },
          "LOGIN_SUSPENDED",
          "USER",
          u.user_id,
          `Akun ditangguhkan setelah ${MAX_LOGIN_ATTEMPTS}x salah kata sandi`
        );
        return NextResponse.json(
          {
            code: "SUSPENDED",
            username: u.username,
            attempts: guardAfter.attempts,
            maxAttempts: guardAfter.maxAttempts,
            waitSeconds: guardAfter.waitSeconds,
            contactEmail: SUPPORT_EMAIL,
            error: `Batas ${MAX_LOGIN_ATTEMPTS} percobaan terlampaui! Login untuk akun "${u.username}" ditangguhkan sementara.`,
          },
          { status: 423 }
        );
      }

      return NextResponse.json(
        {
          code: "WRONG_PASSWORD",
          username: u.username,
          attempts: guardAfter.attempts,
          remainingAttempts: guardAfter.remaining,
          maxAttempts: guardAfter.maxAttempts,
          contactEmail: SUPPORT_EMAIL,
          error: `Kata sandi salah. Sisa percobaan untuk akun "${u.username}": ${guardAfter.remaining} dari ${guardAfter.maxAttempts} percobaan sebelum akun ditangguhkan.`,
        },
        { status: 401 }
      );
    }

    // 5. Login berhasil → bersihkan penghitung salah sandi
    clearLoginGuard(u.username);
    await store.update("USERS", u.user_id, { last_login: nowIso() });
    const s = {
      userId: u.user_id,
      username: u.username,
      name: u.full_name,
      role: u.role_id as any,
      regionId: u.region_id,
      spbuId: u.spbu_id,
    };
    await createSession(s);
    await logActivity(s, "LOGIN", "USER", u.user_id, "Login berhasil");
    return ok();
  });
}
