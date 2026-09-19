import { createMMKV } from "react-native-mmkv";

/**
 * Tiny per-device, unsynced flags — "has this one-time tip been dismissed"
 * — that don't belong in the query cache (queryPersister.ts) or in Supabase
 * (they're not user data, just local UI state). Separate MMKV instance so
 * clearing the query cache never touches these and vice versa.
 */
const storage = createMMKV({ id: "local-flags" });

export function getFlag(key: string): boolean {
  return storage.getBoolean(key) ?? false;
}

export function setFlag(key: string, value: boolean): void {
  storage.set(key, value);
}

export const LOCAL_FLAGS = {
  seenBatteryGuideTip: "seen-battery-guide-tip",
} as const;
