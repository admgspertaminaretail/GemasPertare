import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { saveSpbu, toggleSpbu, saveRegion } from "@/lib/services/master";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const b = await jsonBody(req);
    if (b.action === "create") await saveSpbu(u, b.data);
    else if (b.action === "update") await saveSpbu(u, b.data, String(b.id));
    else if (b.action === "toggle") await toggleSpbu(u, String(b.id), !!b.active);
    else if (b.action === "region_create") await saveRegion(u, b.data);
    else if (b.action === "region_update") await saveRegion(u, b.data, String(b.id));
    else throw new Error("action");
    return ok();
  });
}
