import Constants from "expo-constants";

interface AppExtra {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  mapboxPublicToken?: string;
  appVariant?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as AppExtra;

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it as an env var (see app.config.ts) before starting the app.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: required(extra.supabaseUrl, "EXPO_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required(extra.supabaseAnonKey, "EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  mapboxPublicToken: extra.mapboxPublicToken ?? null,
  appVariant: extra.appVariant ?? "development",
};
