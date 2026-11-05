import { handle, ok } from "@/lib/api";
import { destroySession, getSession } from "@/lib/auth";
import { logActivity } from "@/lib/services/core";

export async function POST() {
  return handle(async () => {
    const u = await getSession();
    if (u) await logActivity(u, "LOGOUT", "USER", u.userId, "Logout");
    destroySession();
    return ok();
  });
}
