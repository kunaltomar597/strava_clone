import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@stride/contracts";
import { env } from "./env";
import { largeSecureStore } from "./secureStorage";

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: largeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// supabase-js's auto-refresh timer keeps firing in the background unless
// told otherwise, which wastes battery and CPU wake-ups on a phone. Only
// run it while the app is actually in the foreground.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
