import { useColorScheme } from "react-native";
import { palettes, type ColorPalette, type ThemeName } from "./tokens";

export interface Theme {
  name: ThemeName;
  colors: ColorPalette;
}

/** The system color scheme, mapped to our own palette — no theme picker in v1, "automatic" only. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === "dark" ? "dark" : "light";
  return { name, colors: palettes[name] };
}
