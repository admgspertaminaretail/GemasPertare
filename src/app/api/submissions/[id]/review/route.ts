import { handle, jsonBody, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { reviewSubmission } from "@/lib/services/submissions";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_REGION"]);
    const b = await jsonBody<{ decision: "approve" | "revise"; note?: string }>(req);
    if (b.decision !== "approve" && b.decision !== "revise") throw new Error("decision");
    await reviewSubmission(u, params.id, b.decision, b.note || "");
    return ok();
  });
}
