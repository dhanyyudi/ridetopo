import { z } from "zod";
import type { BicycleProfile, RoadPreference, TerrainPreference } from "@/domain/route";

const STORAGE_KEY = "ridetopo:preferences:v1";

const preferencesSchema = z.object({
  version: z.literal(1),
  profile: z.enum(["road-bike", "commuter-bike"]),
  roadPreference: z.enum(["standard", "small-roads"]),
  terrainPreference: z.enum(["standard", "flatter"]),
});

export interface StoredPreferences {
  profile: BicycleProfile;
  roadPreference: RoadPreference;
  terrainPreference: TerrainPreference;
}

/**
 * Lightweight UI preferences only. Locations, exclusions, geometry, and the
 * round-trip state belong to the validated IndexedDB draft — nothing here may
 * reveal where someone rides.
 */
export function loadPreferences(
  storage: Storage | null | undefined = safeStorage(),
): StoredPreferences | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = preferencesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const { profile, roadPreference, terrainPreference } = parsed.data;
    return { profile, roadPreference, terrainPreference };
  } catch {
    return null;
  }
}

export function savePreferences(
  preferences: StoredPreferences,
  storage: Storage | null | undefined = safeStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...preferences }));
  } catch {
    /* Private mode or a full quota must never break planning. */
  }
}

export function clearPreferences(storage: Storage | null | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* best effort */
  }
}

/**
 * `null` means "no storage available" and is what callers pass to say so
 * explicitly — passing `undefined` would only re-trigger the default.
 */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
