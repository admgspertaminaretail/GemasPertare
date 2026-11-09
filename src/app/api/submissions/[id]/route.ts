import { handle, ok } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { logActivity } from "@/lib/services/core";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM", "ADMIN_REGION"]);
    const id = params.id;
    const store = await getStore();
    const sub = (await store.list("SUBMISSIONS")).find((s) => s.submission_id === id);
    if (!sub) throw new HttpError(404, "Pengajuan tidak ditemukan.");

    await store.deleteWhere("SUBMISSIONS", (r) => r.submission_id === id);
    await store.deleteWhere("SUBMISSION_DOCUMENTS", (r) => r.submission_id === id);
    await store.deleteWhere("SUBMISSION_PHOTOS", (r) => r.submission_id === id);
    await store.deleteWhere("SUBMISSION_STATUS_HISTORY", (r) => r.submission_id === id);
    await store.deleteWhere("SUBMISSION_REVISION_HISTORY", (r) => r.submission_id === id);
    await store.deleteWhere("FILE_INDEX", (r) => r.entity_id === id);

    await logActivity(u, "HAPUS_PENGAJUAN", "SUBMISSIONS", id, `Pengajuan ${id} berhasil dihapus.`);
    return ok({ success: true, message: `Pengajuan ${id} berhasil dihapus.` });
  });
}
