import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPooling } from "@/lib/services/submissions";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const fupa_number = String(fd.get("fupa_number") || "");
      const pooling_date = String(fd.get("pooling_date") || "");
      const notes = String(fd.get("notes") || "");
      let submission_ids: string[] = [];
      const rawIds = fd.get("submission_ids");
      if (typeof rawIds === "string") {
        try {
          const parsed = JSON.parse(rawIds);
          if (Array.isArray(parsed)) submission_ids = parsed;
          else submission_ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
        } catch {
          submission_ids = rawIds.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } else {
        submission_ids = fd.getAll("submission_ids").map(String);
      }
      const rawFile = fd.get("file");
      const file = rawFile && typeof rawFile !== "string" && rawFile.size > 0 ? (rawFile as File) : undefined;
      const id = await createPooling(u, { fupa_number, pooling_date, submission_ids, notes, file });
      return ok({ id });
    }

    const b = await jsonBody(req);
    const id = await createPooling(u, { fupa_number: b.fupa_number, pooling_date: b.pooling_date, submission_ids: b.submission_ids, notes: b.notes });
    return ok({ id });
  });
}
