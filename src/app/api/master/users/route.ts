import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { saveUser, toggleUser } from "@/lib/services/master";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const b = await jsonBody(req);
    if (b.action === "create") await saveUser(u, b.data);
    else if (b.action === "update") await saveUser(u, b.data, String(b.id));
    else if (b.action === "toggle") await toggleUser(u, String(b.id), !!b.active);
    else throw new Error("action");
    return ok();
  });
}
