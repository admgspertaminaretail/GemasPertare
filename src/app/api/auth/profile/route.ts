import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { updateOwnProfile } from "@/lib/services/master";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser();
    const body = await jsonBody<{ profile_name?: string; employee_id?: string; phone?: string }>(req);
    const saved = await updateOwnProfile(u, body);
    return ok(saved);
  });
}
