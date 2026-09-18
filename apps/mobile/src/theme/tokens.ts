/**
 * Typed design tokens: colors, spacing, type scale. Plain objects consumed
 * by StyleSheet.create — deliberately not a styling library, so the app
 * survives Expo SDK upgrades without a styling-library breakage risk (see
 * the master plan's stack rationale).
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 999,
} as const;

export const typeScale = {
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" as const },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: "700" as const },
  statValue: { fontSize: 28, lineHeight: 32, fontWeight: "700" as const },
  statLabel: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
};

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  accent: string;
  accentMuted: string;
  success: string;
  danger: string;
  warning: string;
}

const light: ColorPalette = {
  background: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  border: "#E1E4E8",
  textPrimary: "#111417",
  textSecondary: "#5B6570",
  textInverse: "#FFFFFF",
  accent: "#FC4C02",
  accentMuted: "#FFE4D6",
  success: "#1FA35C",
  danger: "#D63A3A",
  warning: "#C9820A",
};

const dark: ColorPalette = {
  background: "#0E1013",
  surface: "#181B1F",
  surfaceElevated: "#22262B",
  border: "#2B2F35",
  textPrimary: "#F2F3F5",
  textSecondary: "#9AA3AD",
  textInverse: "#111417",
  accent: "#FF6A2B",
  accentMuted: "#3A2318",
  success: "#39C579",
  danger: "#E5615B",
  warning: "#E0A83C",
};

export const palettes = { light, dark };

export type ThemeName = keyof typeof palettes;
