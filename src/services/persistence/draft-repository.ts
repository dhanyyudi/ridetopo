import { openDB, type IDBPDatabase } from "idb";
import type { DraftV1 } from "@/domain/export";
import { parseDraft } from "./draft-serialization";

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

export interface DraftRepository {
  load(): Promise<DraftV1 | null>;
  save(draft: DraftV1): Promise<void>;
  clear(): Promise<void>;
}

export const draftRepository: DraftRepository = {
  async load(): Promise<DraftV1 | null> {
    try {
      const db = await getDb();
      const raw: unknown = await db.get(STORE_NAME, KEY);
      if (!raw) return null;
      return parseDraft(raw);
    } catch {
      return null;
    }
  },

  async save(draft: DraftV1): Promise<void> {
    try {
      const parsed = parseDraft(draft);
      if (!parsed) return;
      const db = await getDb();
      await db.put(STORE_NAME, parsed, KEY);
    } catch {
      /* best effort */
    }
  },

  async clear(): Promise<void> {
    try {
      const db = await getDb();
      await db.delete(STORE_NAME, KEY);
    } catch {
      /* best effort */
    }
  },
};
