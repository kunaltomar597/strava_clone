import { Pressable, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EffortKeyContract } from "@stride/contracts";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { formatDuration } from "@/lib/format";
import { useBestEfforts } from "@/features/profile/useBestEfforts";

const EFFORT_LABEL: Record<EffortKeyContract, string> = {
  "400m": "400 m",
  "1k": "1 km",
  "1mi": "1 mile",
  "5k": "5 km",
  "10k": "10 km",
  half: "Half marathon",
  marathon: "Marathon",
};

export default function BestEffortsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: efforts, isPending } = useBestEfforts();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.md }}>
      <Text style={[typeScale.largeTitle, { color: colors.textPrimary, paddingHorizontal: spacing.md }]}>
        Personal records
      </Text>
      <FlashList
        data={efforts ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => {
          const activity = item.activities as unknown as { name: string; started_at: string } | null;
          return (
            <Pressable onPress={() => router.push(`/activity/${item.activity_id}`)} style={{ marginBottom: spacing.sm }}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={[typeScale.bodyBold, { color: colors.textPrimary }]}>
                      {EFFORT_LABEL[item.effort_key]}
                    </Text>
                    <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                      {activity?.name} · {activity ? new Date(activity.started_at).toLocaleDateString() : ""}
                    </Text>
                  </View>
                  <Text style={[typeScale.title, { color: colors.accent }]}>{formatDuration(item.elapsed_time_s)}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !isPending ? (
            <EmptyState title="No records yet" message="Personal records appear here once you've recorded a few activities." />
          ) : null
        }
      />
    </View>
  );
}
