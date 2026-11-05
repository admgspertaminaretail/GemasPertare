import { handle, formBody, ok } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { saveTemplate, setTemplateActive } from "@/lib/services/content";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const fd = await formBody(req);
    const action = String(fd.get("action") || "");
    const id = String(fd.get("id") || "");
    if (action === "create") await saveTemplate(u, fd);
    else if (action === "update") await saveTemplate(u, fd, id);
    else if (action === "toggle") await setTemplateActive(u, id, fd.get("active") === "1");
    else throw new HttpError(400, "Aksi tidak dikenal.");
    return ok();
  });
}
