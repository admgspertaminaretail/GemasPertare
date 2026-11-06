import { getStore } from "../db";
import {
  DEFAULT_KEY_PATH,
  getActiveDbDriver,
  getActiveDriveFolderId,
  getActiveFileDriver,
  getActiveSheetsId,
  loadGoogleCredentials,
  readCloudConfig,
} from "../google";
import { SCHEMA, TABLES } from "../schema";

export async function getDatabaseStatus() {
  const cred = loadGoogleCredentials();
  const cfg = readCloudConfig();
  const dbDriver = getActiveDbDriver();
  const fileDriver = getActiveFileDriver();
  const sheetsId = getActiveSheetsId();
  const driveFolderId = getActiveDriveFolderId();

  const store = await getStore();
  const counts: { table: string; columns: number; rows: number }[] = [];
  for (const t of TABLES) {
    const list = await store.list(t);
    counts.push({ table: t, columns: SCHEMA[t].length, rows: list.length });
  }
  const fileIndex = (await store.list("FILE_INDEX"))
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
    .slice(0, 50);

  return {
    credential: cred
      ? { found: true, email: cred.email, projectId: cred.projectId, source: cred.source }
      : { found: false, email: "", projectId: "", source: "" },
    expectedKeyPath: DEFAULT_KEY_PATH,
    dbDriver,
    fileDriver,
    sheetsId,
    spreadsheetUrl: sheetsId ? `https://docs.google.com/spreadsheets/d/${sheetsId}/edit` : "",
    driveFolderId,
    folderUrl: driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : "",
    parentFolderId: cfg.parentFolderId || "",
    shareEmail: cfg.shareEmail || "",
    initializedAt: cfg.initializedAt || "",
    counts,
    fileIndex,
  };
}

export type DatabaseStatus = Awaited<ReturnType<typeof getDatabaseStatus>>;
