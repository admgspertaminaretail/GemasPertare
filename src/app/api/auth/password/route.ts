import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { changeOwnPassword } from "@/lib/services/master";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser();
    const b = await jsonBody<{ current: string; next: string }>(req);
    await changeOwnPassword(u, String(b.current || ""), String(b.next || ""));
    return ok();
  });
}
