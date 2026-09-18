import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { StatBlock, StatRow } from "@/components/StatBlock";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { formatDistance, formatDuration } from "@/lib/format";
import { useMyProfile, useProfileTotals } from "@/features/profile/useProfile";
import { supabase } from "@/lib/supabase";

export default function YouScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: profile } = useMyProfile();
  const { data: weeklyTotals } = useProfileTotals("week");

  const thisWeek = weeklyTotals?.[weeklyTotals.length - 1];
  const lastFourWeeks = weeklyTotals?.slice(-4) ?? [];
  const monthDistanceM = lastFourWeeks.reduce((sum, w) => sum + w.distance_m, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
    >
      {profile ? (
        <View style={styles.header}>
          <Avatar avatarPath={profile.avatar_path} displayName={profile.display_name} size={64} />
          <View style={{ marginLeft: spacing.md }}>
            <Text style={[typeScale.title, { color: colors.textPrimary }]}>{profile.display_name}</Text>
            <Text style={[typeScale.body, { color: colors.textSecondary }]}>@{profile.username}</Text>
          </View>
        </View>
      ) : null}

      {profile ? (
        <Card style={{ marginTop: spacing.md }}>
          <StatRow>
            <StatBlock label="Activities" value={String(profile.activity_count)} align="center" />
            <StatBlock label="Followers" value={String(profile.followers_count)} align="center" />
            <StatBlock label="Following" value={String(profile.following_count)} align="center" />
          </StatRow>
        </Card>
      ) : null}

      <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.lg }]}>This week</Text>
      <Card style={{ marginTop: spacing.sm }}>
        <StatRow>
          <StatBlock label="Distance" value={thisWeek ? formatDistance(thisWeek.distance_m, "metric") : "--"} />
          <StatBlock label="Time" value={thisWeek ? formatDuration(thisWeek.moving_time_s) : "--"} />
          <StatBlock label="Activities" value={thisWeek ? String(thisWeek.activity_count) : "--"} />
        </StatRow>
      </Card>

      <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.lg }]}>Last 4 weeks</Text>
      <Card style={{ marginTop: spacing.sm }}>
        <StatBlock label="Distance" value={formatDistance(monthDistanceM, "metric")} />
      </Card>

      <View style={{ marginTop: spacing.xxl }}>
        <Button label="Sign out" variant="ghost" onPress={() => void supabase.auth.signOut()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
});
