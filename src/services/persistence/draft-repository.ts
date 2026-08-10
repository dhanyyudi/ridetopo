import { openDB, type IDBPDatabase } from "idb";
import type { DraftV1 } from "@/domain/export";

const DB_NAME = "ridetopo-draft";
const STORE_NAME = "drafts";
const KEY = "active";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export const draftRepository = {
  async load(): Promise<DraftV1 | null> {
    try {
      const db = await getDb();
      const raw = await db.get(STORE_NAME, KEY);
      if (!raw) return null;

      const draft = raw as DraftV1;
      if (draft.version !== 1) return null;
      if (!draft.route || !draft.route.id) return null;

      return draft;
    } catch {
      return null;
    }
  },

  async save(draft: DraftV1): Promise<void> {
    try {
      const db = await getDb();
      await db.put(STORE_NAME, draft, KEY);
    } catch {
      // Silently fail - draft is best-effort
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await getDb();
      await db.delete(STORE_NAME, KEY);
    } catch {
      // Silently fail
    }
  },
};
