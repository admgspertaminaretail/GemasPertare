import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createMemo } from "@/lib/services/submissions";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const memo_number = String(fd.get("memo_number") || "");
      const memo_date = String(fd.get("memo_date") || "");
      const notes = String(fd.get("notes") || "");
      let pooling_ids: string[] = [];
      const rawIds = fd.get("pooling_ids");
      if (typeof rawIds === "string") {
        try {
          const parsed = JSON.parse(rawIds);
          if (Array.isArray(parsed)) pooling_ids = parsed;
          else pooling_ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
        } catch {
          pooling_ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } else {
        pooling_ids = fd.getAll("pooling_ids").map(String);
      }
      const rawFile = fd.get("file");
      const file = rawFile && typeof rawFile !== "string" && rawFile.size > 0 ? (rawFile as File) : undefined;
      const id = await createMemo(u, { memo_number, memo_date, pooling_ids, notes, file });
      return ok({ id });
    }

    const b = await jsonBody(req);
    const id = await createMemo(u, { memo_number: b.memo_number, memo_date: b.memo_date, pooling_ids: b.pooling_ids, notes: b.notes });
    return ok({ id });
  });
}
