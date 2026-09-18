import { createMMKV } from "react-native-mmkv";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Query } from "@tanstack/react-query";

const storage = createMMKV({ id: "query-cache" });

/**
 * MMKV is synchronous, but the persister's `AsyncStorage` interface accepts
 * a plain value or a promise for every method — no wrapping needed.
 */
const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

const persister = createAsyncStoragePersister({
  storage: mmkvStorage,
  key: "stride-query-cache",
  throttleTime: 1000,
});

/**
 * Only "first feed page, your profile, recently opened activities" persist
 * offline, per the master plan — search results, one-off RPC calls, and
 * anything keyed by a mutation don't need to survive a restart.
 */
const PERSISTED_QUERY_KEY_PREFIXES = ["home-feed", "profile", "profile-by-username", "activity", "notifications"];

export const persistOptions = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => {
      const [prefix] = query.queryKey;
      return typeof prefix === "string" && PERSISTED_QUERY_KEY_PREFIXES.includes(prefix);
    },
  },
};
