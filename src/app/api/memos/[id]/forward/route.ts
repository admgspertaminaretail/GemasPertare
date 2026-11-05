import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateForwarding } from "@/lib/services/submissions";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const b = await jsonBody(req);
    await updateForwarding(u, params.id, { status: b.status, forwarded_date: b.forwarded_date, notes: b.notes });
    return ok();
  });
}
