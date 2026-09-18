import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/useTheme";
import { radius, spacing, typeScale } from "@/theme/tokens";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  fullWidth = true,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();

  const backgroundColor = {
    primary: colors.accent,
    secondary: colors.surfaceElevated,
    ghost: "transparent",
    destructive: colors.danger,
  }[variant];

  const textColor = variant === "primary" || variant === "destructive" ? colors.textInverse : colors.textPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={(e) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: colors.border,
          alignSelf: fullWidth ? "stretch" : "flex-start",
        },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[typeScale.bodyBold, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
