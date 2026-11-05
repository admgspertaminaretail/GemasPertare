import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { cancelPooling } from "@/lib/services/submissions";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const b = await jsonBody(req);
    await cancelPooling(u, params.id, String(b.reason || ""));
    return ok();
  });
}
