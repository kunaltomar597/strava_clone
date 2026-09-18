import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";

export interface EmptyStateProps {
  title: string;
  message?: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[typeScale.title, { color: colors.textPrimary, textAlign: "center" }]}>{title}</Text>
      {message ? (
        <Text
          style={[
            typeScale.body,
            { color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
});
