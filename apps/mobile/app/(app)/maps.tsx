import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";

/**
 * Placeholder for the Maps tab's Mapbox integration (location puck, style
 * switch — Phase 2). Rendering an actual @rnmapbox/maps <MapView> needs a
 * Mapbox account, a public token, and a native build to verify on a real
 * device/simulator, none of which exist in the environment this was built
 * in. This screen implements the permission-primer flow for real, so
 * wiring in the map itself later is the only remaining piece.
 */
export default function MapsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);

  async function requestPermission() {
    const result = await Location.requestForegroundPermissionsAsync();
    setStatus(result.status);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg }]}>
      <Text style={[typeScale.title, { color: colors.textPrimary }]}>Maps</Text>
      <Text style={[typeScale.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        Stride uses your location to show where you are and to record activities. This is used only while
        you have the app open or are recording.
      </Text>
      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={status === Location.PermissionStatus.GRANTED ? "Location enabled" : "Enable location"}
          onPress={requestPermission}
          disabled={status === Location.PermissionStatus.GRANTED}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
});
