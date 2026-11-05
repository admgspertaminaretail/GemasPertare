import { handle, formBody, ok } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { saveKnowledge, reindexKnowledge } from "@/lib/services/content";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const fd = await formBody(req);
    const action = String(fd.get("action") || "");
    const id = String(fd.get("id") || "");
    if (action === "create") return ok(await saveKnowledge(u, fd));
    if (action === "update") return ok(await saveKnowledge(u, fd, id));
    if (action === "reindex") return ok({ ai: await reindexKnowledge(u, id) });
    throw new HttpError(400, "Aksi tidak dikenal.");
  });
}
