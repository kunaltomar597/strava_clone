import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";

export interface StatBlockProps {
  label: string;
  value: string;
  align?: "left" | "center";
}

export function StatBlock({ label, value, align = "left" }: StatBlockProps) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: align === "center" ? "center" : "flex-start" }}>
      <Text style={[typeScale.statValue, { color: colors.textPrimary }]} accessibilityRole="text">
        {value}
      </Text>
      <Text
        style={[typeScale.statLabel, { color: colors.textSecondary, marginTop: spacing.xs, textTransform: "uppercase" }]}
      >
        {label}
      </Text>
    </View>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
