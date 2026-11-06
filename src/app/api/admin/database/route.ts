import { handle, jsonBody, formBody, ok } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getLocalSnapshot, resetStoreCache } from "@/lib/db";
import {
  autoInitializeGoogleWorkspace,
  getActiveDbDriver,
  getActiveDriveFolderId,
  getActiveSheetsId,
  loadGoogleCredentials,
  saveCloudConfig,
  saveServiceAccountJson,
} from "@/lib/google";
import { saveFile, validateUpload } from "@/lib/storage";
import { logActivity } from "@/lib/services/core";
import { getDatabaseStatus } from "@/lib/services/database";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireUser(["ADMIN_PAM"]);
    return ok(await getDatabaseStatus());
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const u = await requireUser(["ADMIN_PAM"]);
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const fd = await formBody(req);
      const title = String(fd.get("title") || "").trim();
      if (title.length < 2) throw new HttpError(400, "Judul berkas wajib diisi (minimal 2 karakter).");
      const rawFile = fd.get("file");
      const ext = rawFile instanceof File ? (rawFile.name.split(".").pop() || "").toLowerCase() : "";
      const kindInput = ext === "jpg" || ext === "jpeg" || ext === "png" ? "image" : "document";
      let validated;
      try {
        validated = await validateUpload(rawFile instanceof File ? rawFile : null, kindInput, "Berkas");
      } catch (err: any) {
        throw new HttpError(400, err.message);
      }
      try {
        const ref = await saveFile(validated, "knowledge", {
          title,
          entityId: "CLOUD_UPLOAD",
          uploadedBy: u.name,
        });
        await logActivity(u, "UNGGAH_ARSIP_CLOUD", "FILE_INDEX", ref, title);
        return ok({ ref, status: await getDatabaseStatus() });
      } catch (err: any) {
        throw new HttpError(400, err.message || "Gagal mengunggah berkas ke penyimpanan.");
      }
    }

    const body = await jsonBody<{
      action: "init" | "switch" | "sync" | "upload_key";
      keyJson?: string;
      parentFolderId?: string;
      shareEmail?: string;
      existingSheetsId?: string;
      existingDriveFolderId?: string;
      activate?: boolean;
      mode?: "local" | "google";
    }>(req);

    try {
      if (body.action === "upload_key") {
        const info = saveServiceAccountJson(String(body.keyJson || ""));
        await logActivity(u, "SIMPAN_KUNCI_GOOGLE", "SYSTEM", info.email, "File kunci Service Account berhasil dipasang");
        return ok({ credential: info, status: await getDatabaseStatus() });
      }

      if (body.action === "init") {
        const result = await autoInitializeGoogleWorkspace({
          parentFolderId: body.parentFolderId,
          shareEmail: body.shareEmail,
          existingSheetsId: body.existingSheetsId,
          existingDriveFolderId: body.existingDriveFolderId,
          seedMode: "migrate",
          activate: body.activate !== false,
          localRowsProvider: getLocalSnapshot,
        });
        resetStoreCache();
        await logActivity(u, "INIT_GOOGLE_DB", "SYSTEM", result.sheetsId, `Sheets & Drive siap (${result.seededRows} baris disinkronkan)`);
        return ok({ result, status: await getDatabaseStatus() });
      }

      if (body.action === "sync") {
        const result = await autoInitializeGoogleWorkspace({
          seedMode: "force_sync",
          activate: getActiveDbDriver() === "sheets",
          localRowsProvider: getLocalSnapshot,
        });
        resetStoreCache();
        await logActivity(u, "SYNC_LOCAL_TO_SHEETS", "SYSTEM", result.sheetsId, `${result.seededRows} baris lokal disalin ke Google Sheets`);
        return ok({ result, status: await getDatabaseStatus() });
      }

      if (body.action === "switch") {
        if (body.mode === "google") {
          if (!loadGoogleCredentials()) {
            throw new HttpError(400, "File kunci credentials/service-account.json belum ditemukan.");
          }
          if (!getActiveSheetsId() || !getActiveDriveFolderId()) {
            await autoInitializeGoogleWorkspace({
              seedMode: "migrate",
              activate: true,
              localRowsProvider: getLocalSnapshot,
            });
          } else {
            saveCloudConfig({ dbDriver: "sheets", fileDriver: "drive" });
          }
        } else {
          saveCloudConfig({ dbDriver: "local", fileDriver: "local" });
        }
        resetStoreCache();
        return ok({ status: await getDatabaseStatus() });
      }
    } catch (err: any) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(400, err.message || "Gagal memproses konfigurasi Google Cloud.");
    }

    throw new HttpError(400, "Aksi tidak dikenal.");
  });
}
