import { LocalStore, SheetsStore, Store } from "./store";
import { buildSeed } from "./seed";

const g = globalThis as unknown as { __gemasStore?: Promise<Store> };

/** Singleton store. Driver dipilih dari env DB_DRIVER (local | sheets). */
export function getStore(): Promise<Store> {
  if (!g.__gemasStore) {
    g.__gemasStore = (async () => {
      if ((process.env.DB_DRIVER || "local") === "sheets") return new SheetsStore();
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
