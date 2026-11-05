import { handle, formBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { resubmit } from "@/lib/services/submissions";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_SPBU"]);
    await resubmit(u, params.id, await formBody(req));
    return ok();
  });
}
