import type { ExpoConfig } from "expo/config";

/**
 * EAS_BUILD_PROFILE / APP_VARIANT selects development | preview | production.
 * Each variant gets its own bundle identifier so all three can be installed
 * on the same device side by side, per the master plan's Phase 0 setup.
 */
const VARIANT = (process.env.APP_VARIANT ?? "development") as "development" | "preview" | "production";

const BUNDLE_ID_SUFFIX: Record<typeof VARIANT, string> = {
  development: ".dev",
  preview: ".preview",
  production: "",
};

const APP_NAME: Record<typeof VARIANT, string> = {
  development: "Stride (Dev)",
  preview: "Stride (Preview)",
  production: "Stride",
};

// "com.stride.app" is a placeholder bundle ID — replace before store submission.
const BASE_BUNDLE_ID = "com.stride.app";
const bundleId = `${BASE_BUNDLE_ID}${BUNDLE_ID_SUFFIX[VARIANT]}`;

const config: ExpoConfig = {
  name: APP_NAME[VARIANT],
  slug: "stride",
  scheme: "stride",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  // No newArchEnabled flag: SDK 55+ dropped the Legacy Architecture, so the
  // New Architecture is the only option and isn't a config field anymore.
  ios: {
    supportsTablet: false,
    bundleIdentifier: bundleId,
    // Background location mode + the blue "in use" indicator, per section 2
    // of the master plan: When-In-Use only, never "Always".
    infoPlist: {
      UIBackgroundModes: ["location"],
      NSLocationWhenInUseUsageDescription:
        "Stride uses your location to record your route, pace and distance while you're recording an activity.",
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    // No ACCESS_BACKGROUND_LOCATION: recording runs as a visible foreground
    // service instead (section 2). FOREGROUND_SERVICE_LOCATION is required
    // on Android 14+ for a location-type foreground service.
    permissions: ["FOREGROUND_SERVICE", "FOREGROUND_SERVICE_LOCATION", "POST_NOTIFICATIONS"],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#FC4C02",
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          // SDK 57 needs the scene-based lifecycle for the iOS 27 SDK.
          enableSceneSupport: true,
        },
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    mapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN,
    appVariant: VARIANT,
  },
};

export default config;
