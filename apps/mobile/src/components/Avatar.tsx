import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/theme/useTheme";
import { typeScale } from "@/theme/tokens";
import { env } from "@/lib/env";

export interface AvatarProps {
  avatarPath: string | null;
  displayName: string;
  size?: number;
}

/** Public avatars bucket — a plain public URL, unlike the private activity-photos bucket. */
function avatarUrl(avatarPath: string): string {
  return `${env.supabaseUrl}/storage/v1/object/public/avatars/${avatarPath}`;
}

export function Avatar({ avatarPath, displayName, size = 40 }: AvatarProps) {
  const { colors } = useTheme();
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (avatarPath) {
    return (
      <Image
        source={{ uri: avatarUrl(avatarPath) }}
        style={dimension}
        contentFit="cover"
        transition={150}
        cachePolicy="disk"
      />
    );
  }

  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={[styles.placeholder, dimension, { backgroundColor: colors.accentMuted }]}>
      <Text style={[typeScale.bodyBold, { color: colors.accent, fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
});
