import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { formatDistance, formatDuration, formatElevation } from "@/lib/format";
import { Card } from "./Card";
import { Avatar } from "./Avatar";
import { FeedMapThumbnail } from "./FeedMapThumbnail";
import type { FeedItem } from "@/features/feed/useHomeFeed";
import { useSignedPhotoUrls } from "@/features/feed/useSignedPhotoUrls";

export interface ActivityCardProps {
  activity: FeedItem;
  onToggleKudos: () => void;
  onPress: () => void;
}

const SPORT_LABEL: Record<FeedItem["sport_type"], string> = {
  run: "Run",
  ride: "Ride",
  walk: "Walk",
  hike: "Hike",
};

export function ActivityCard({ activity, onToggleKudos, onPress }: ActivityCardProps) {
  const { colors } = useTheme();
  const photoPaths = activity.photo_paths.slice(0, 3);
  const { data: signedUrls } = useSignedPhotoUrls(photoPaths);

  return (
    <Pressable onPress={onPress} style={{ marginBottom: spacing.md }}>
      <Card>
        <View style={styles.header}>
          <Avatar avatarPath={activity.avatar_path} displayName={activity.display_name} size={36} />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text style={[typeScale.bodyBold, { color: colors.textPrimary }]}>{activity.display_name}</Text>
            <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
              {SPORT_LABEL[activity.sport_type]} · {new Date(activity.started_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.sm }]}>{activity.name}</Text>

        <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
          <Stat label="Distance" value={formatDistance(activity.distance_m, "metric")} />
          <Stat label="Time" value={formatDuration(activity.moving_time_s)} />
          <Stat label="Elevation" value={formatElevation(activity.elevation_gain_m, "metric")} />
        </View>

        {activity.summary_polyline ? (
          <View style={{ marginTop: spacing.md }}>
            <FeedMapThumbnail summaryPolyline={activity.summary_polyline} />
          </View>
        ) : null}

        {photoPaths.length > 0 ? (
          <View style={[styles.photoRow, { marginTop: spacing.sm }]}>
            {photoPaths.map((path) =>
              signedUrls?.[path] ? (
                <Image key={path} source={{ uri: signedUrls[path] }} style={styles.photo} contentFit="cover" />
              ) : (
                <View key={path} style={[styles.photo, { backgroundColor: colors.surfaceElevated }]} />
              ),
            )}
          </View>
        ) : null}

        <View style={[styles.footer, { borderTopColor: colors.border, marginTop: spacing.sm }]}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleKudos();
            }}
            style={styles.kudosButton}
            accessibilityRole="button"
            accessibilityLabel={activity.has_kudoed ? "Remove kudos" : "Give kudos"}
          >
            <Text style={[typeScale.bodyBold, { color: activity.has_kudoed ? colors.accent : colors.textSecondary }]}>
              👏 {activity.kudos_count}
            </Text>
          </Pressable>
          <Text style={[typeScale.body, { color: colors.textSecondary }]}>{activity.comment_count} comments</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={[typeScale.bodyBold, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typeScale.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  photoRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  photo: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  kudosButton: {
    paddingVertical: spacing.xs,
  },
});
