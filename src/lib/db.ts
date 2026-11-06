import { LocalStore, SheetsStore, Store } from "./store";
import { buildSeed } from "./seed";
import { Row, TABLES, TableName } from "./schema";
import { autoInitializeGoogleWorkspace, getActiveDbDriver, getActiveSheetsId, loadGoogleCredentials } from "./google";

const STORE_VER = `v2-${TABLES.length}`;
const g = globalThis as unknown as { __gemasStore?: Promise<Store>; __gemasStoreVer?: string };

/** Mengambil seluruh isi database lokal (atau membangun seed awal bila db.json belum ada). */
export async function getLocalSnapshot(): Promise<Record<TableName, Row[]>> {
  const local = LocalStore.exists() ? LocalStore.load() : new LocalStore(await buildSeed({ demo: true }));
  if (!LocalStore.exists()) local.persist();
  const entries = await Promise.all(TABLES.map(async (t) => [t, await local.list(t)] as const));
  return Object.fromEntries(entries) as Record<TableName, Row[]>;
}

/** Singleton store. Driver dipilih dari konfigurasi aktif (local | sheets) dengan dukungan auto-init Google Drive/Sheets. */
export function getStore(): Promise<Store> {
  if (g.__gemasStoreVer !== STORE_VER) {
    g.__gemasStore = undefined;
    g.__gemasStoreVer = STORE_VER;
  }
  if (!g.__gemasStore) {
    g.__gemasStore = (async () => {
      if (getActiveDbDriver() === "sheets") {
        if (!getActiveSheetsId() && loadGoogleCredentials()) {
          await autoInitializeGoogleWorkspace({ seedMode: "migrate", activate: true, localRowsProvider: getLocalSnapshot });
        }
        const sheetsStore = new SheetsStore();
        await sheetsStore.ensureSchema();
        return sheetsStore;
      }
      if (LocalStore.exists()) return LocalStore.load();
      const store = new LocalStore(await buildSeed({ demo: true }));
      store.persist();
      return store;
    })().catch((e) => {
      g.__gemasStore = undefined;
      throw e;
    });
  }
  return g.__gemasStore;
}

export function resetStoreCache() {
  g.__gemasStore = undefined;
}
