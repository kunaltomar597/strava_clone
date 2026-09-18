// @ts-check
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/ios/**",
      "**/android/**",
      "**/*.gpx",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/scripts/**/*.mjs", "**/*.config.js", "**/*.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
      },
    },
  },
  {
    // Edge Functions run on Deno, not Node — a different global set.
    files: ["supabase/functions/**/*.ts"],
    languageOptions: {
      globals: {
        Deno: "readonly",
        Response: "readonly",
        Request: "readonly",
        Blob: "readonly",
        DecompressionStream: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        console: "readonly",
      },
    },
  },
  {
    // app.config.ts is loaded by Node (via Metro/expo-cli's config
    // resolver), not bundled into the app itself.
    files: ["apps/mobile/app.config.ts"],
    languageOptions: {
      globals: {
        process: "readonly",
      },
    },
  },
  {
    // React Native's JS runtime (Hermes) exposes browser-like globals,
    // some via polyfills this app installs (react-native-get-random-values).
    files: ["apps/mobile/src/**/*.ts", "apps/mobile/src/**/*.tsx", "apps/mobile/app/**/*.tsx"],
    languageOptions: {
      globals: {
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        console: "readonly",
        __DEV__: "readonly",
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unused-vars": "off",
    },
  },
  prettierConfig,
];
