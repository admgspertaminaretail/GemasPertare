import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/api/auth/login", "/api/setup"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const token = req.cookies.get("gemas_session")?.value;
  let ok = false;
  if (token) {
    try {
      const s = process.env.AUTH_SECRET;
      const key = new TextEncoder().encode(s && s.length >= 32 ? s : "dev-only-secret-dev-only-secret-dev-only-1234");
      await jwtVerify(token, key);
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (ok) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"] };
