import { formBody, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listHomeSlides, manageHomeSlide } from "@/lib/services/home";

export async function GET() {
  return handle(async () => {
    const u = await requireUser();
    return ok({ slides: await listHomeSlides(u) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const fd = await formBody(req);
    return ok(await manageHomeSlide(u, fd));
  });
}
