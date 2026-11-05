import { handle, formBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createSubmission } from "@/lib/services/submissions";

export const maxDuration = 60;

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_SPBU"]);
    const id = await createSubmission(u, await formBody(req));
    return ok({ id });
  });
}
