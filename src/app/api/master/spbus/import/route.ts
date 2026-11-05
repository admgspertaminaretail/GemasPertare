import { handle, formBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { importSpbuExcel } from "@/lib/services/master";

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const fd = await formBody(req);
    const report = await importSpbuExcel(u, fd.get("file") as File | null);
    return ok({ report });
  });
}
