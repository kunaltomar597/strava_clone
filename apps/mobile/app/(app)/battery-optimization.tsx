import { Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { getBatteryGuide } from "@/features/recorder/batteryGuide";

/**
 * Phase 4's "vendor battery-manager guide" item from the release checklist.
 * Recording relies on staying alive in the background; several Android
 * OEMs kill background apps far more than stock Android regardless of the
 * permissions this app already requests, so the best remaining mitigation
 * is telling each user exactly what to change on their specific device.
 */
export default function BatteryOptimizationScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const guide = getBatteryGuide(Device.brand);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
    >
      <Text style={[typeScale.largeTitle, { color: colors.textPrimary }]}>Keep recording reliable</Text>
      <Text style={[typeScale.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        Some phone makers aggressively stop apps running in the background to save battery — even ones you're
        actively using to record a route. If your activities cut off early or lose GPS points while your screen is
        off, this is almost always why.
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[typeScale.title, { color: colors.textPrimary }]}>{guide.vendorLabel}</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
          {guide.steps.map((step, i) => (
            <Text key={i} style={[typeScale.body, { color: colors.textPrimary }]}>
              {i + 1}. {step}
            </Text>
          ))}
        </View>
      </Card>

      <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
        Exact wording varies by OS version and region — look for the setting closest to what's described above.
      </Text>

      {Platform.OS === "android" ? (
        <View style={{ marginTop: spacing.lg }}>
          <Button label="Open app settings" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
    </ScrollView>
  );
}
