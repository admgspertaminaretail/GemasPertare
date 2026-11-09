import { NextResponse } from "next/server";
import { HttpError } from "./auth";

export function ok(data: unknown = {}) {
  return NextResponse.json({ ok: true, ...(data as object) });
}

/** Pembungkus route handler: mengubah HttpError menjadi respons JSON berpesan Indonesia. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e: any) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[API]", e);
    const msg = e?.message || "Terjadi kesalahan pada server. Silakan coba lagi.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function jsonBody<T = any>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Permintaan tidak valid.");
  }
}

export async function formBody(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new HttpError(400, "Form tidak valid atau ukuran file terlalu besar.");
  }
}
