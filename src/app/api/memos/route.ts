import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createMemo } from "@/lib/services/submissions";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const b = await jsonBody(req);
    const id = await createMemo(u, { memo_number: b.memo_number, memo_date: b.memo_date, pooling_ids: b.pooling_ids, notes: b.notes });
    return ok({ id });
  });
}
