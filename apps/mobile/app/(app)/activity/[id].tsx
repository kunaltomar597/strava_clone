import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { RouteMap } from "@/components/RouteMap";
import { ActivityChart, type ActivityChartPoint } from "@/components/ActivityChart";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { formatDistance, formatDuration, formatElevation, formatPace } from "@/lib/format";
import { useActivity, useActivityStreams } from "@/features/activity/useActivity";
import { useAddComment, useComments } from "@/features/comments/useComments";
import { useToggleKudos } from "@/features/feed/useKudos";

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: activity, isPending } = useActivity(id);
  const { data: streams } = useActivityStreams(id);
  const { data: comments } = useComments(id);
  const addComment = useAddComment(id);
  const toggleKudos = useToggleKudos();
  const [commentText, setCommentText] = useState("");

  const routeCoordinates = useMemo(() => {
    if (!streams) return [];
    return streams.lat_e7.map((latE7, i) => ({ lat: latE7 / 1e7, lng: streams.lng_e7[i]! / 1e7 }));
  }, [streams]);

  const chartData = useMemo<ActivityChartPoint[]>(() => {
    if (!streams) return [];
    return streams.distance_m.map((distanceM, i) => ({
      distanceKm: distanceM / 1000,
      elevationM: streams.altitude_m[i] ?? 0,
      paceMps: streams.speed_mps[i] ?? 0,
    }));
  }, [streams]);

  if (isPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!activity) {
    return <EmptyState title="Activity not found" message="It may have been deleted, or you may not have access." />;
  }

  const author = activity.profiles as unknown as { display_name: string; avatar_path: string | null } | null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
    >
      <Text style={[typeScale.largeTitle, { color: colors.textPrimary }]}>{activity.name}</Text>
      <Text style={[typeScale.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
        {author?.display_name} · {new Date(activity.started_at).toLocaleString()}
      </Text>

      {routeCoordinates.length >= 2 ? (
        <View style={{ marginTop: spacing.md }}>
          <RouteMap coordinates={routeCoordinates} height={220} />
        </View>
      ) : null}

      <Card style={{ marginTop: spacing.md }}>
        <View style={styles.statsGrid}>
          <Stat label="Distance" value={formatDistance(activity.distance_m, "metric")} />
          <Stat label="Moving time" value={formatDuration(activity.moving_time_s)} />
          <Stat label="Elapsed time" value={formatDuration(activity.elapsed_time_s)} />
          <Stat label="Pace" value={formatPace(activity.avg_speed_mps ?? 0, "metric")} />
          <Stat label="Elevation gain" value={formatElevation(activity.elevation_gain_m, "metric")} />
          <Stat label="Calories" value={activity.calories ? String(Math.round(activity.calories)) : "--"} />
        </View>
      </Card>

      {activity.description ? (
        <Text style={[typeScale.body, { color: colors.textPrimary, marginTop: spacing.md }]}>
          {activity.description}
        </Text>
      ) : null}

      {chartData.length >= 2 ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <ActivityChart data={chartData} metric="elevation" />
          <ActivityChart data={chartData} metric="pace" />
        </View>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={`👏 Kudos (${activity.kudos_count})`}
          variant="secondary"
          onPress={() =>
            toggleKudos.mutate({
              activityId: activity.id,
              // Detail view doesn't track has_kudoed locally yet; always attempts
              // to give kudos here — a duplicate is a harmless idempotent no-op
              // enforced by the kudos table's primary key.
              hasKudoed: false,
            })
          }
        />
      </View>

      <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.lg }]}>
        Comments ({activity.comment_count})
      </Text>
      {(comments ?? []).map((comment) => {
        const commentAuthor = comment.profiles as unknown as { display_name: string } | null;
        return (
          <View key={comment.id} style={{ marginTop: spacing.sm }}>
            <Text style={[typeScale.bodyBold, { color: colors.textPrimary }]}>{commentAuthor?.display_name}</Text>
            <Text style={[typeScale.body, { color: colors.textPrimary }]}>{comment.body}</Text>
          </View>
        );
      })}

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <TextField placeholder="Add a comment" value={commentText} onChangeText={setCommentText} multiline />
        <Button
          label="Post"
          disabled={commentText.trim().length === 0}
          loading={addComment.isPending}
          onPress={() => {
            addComment.mutate(commentText.trim(), { onSuccess: () => setCommentText("") });
          }}
        />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.statCell}>
      <Text style={[typeScale.bodyBold, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  statCell: {
    width: "33%",
    marginBottom: spacing.sm,
  },
});
