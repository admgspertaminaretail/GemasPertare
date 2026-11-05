import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { askGemas } from "@/lib/services/rag";
import { logActivity } from "@/lib/services/core";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser();
    const b = await jsonBody<{ question: string; history?: { role: string; text: string }[] }>(req);
    const q = String(b.question || "").trim();
    if (q.length < 3) throw new HttpError(400, "Tulis pertanyaan Anda terlebih dahulu.");
    const res = await askGemas(q, Array.isArray(b.history) ? b.history.slice(-6) : []);
    await logActivity(u, "TANYA_AI", "AI", res.mode, q.slice(0, 120));
    return ok(res);
  });
}
