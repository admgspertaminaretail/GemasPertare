import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createPooling } from "@/lib/services/submissions";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const b = await jsonBody(req);
    const id = await createPooling(u, { fupa_number: b.fupa_number, pooling_date: b.pooling_date, submission_ids: b.submission_ids, notes: b.notes });
    return ok({ id });
  });
}
