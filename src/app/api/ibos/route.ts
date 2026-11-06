import { formBody, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listIbosExtracts, manageIbosExtract } from "@/lib/services/ibos";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    return ok(await listIbosExtracts(u));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const fd = await formBody(req);
    return ok(await manageIbosExtract(u, fd));
  });
}
