import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { StatBlock, StatRow } from "@/components/StatBlock";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { useProfileByUsername } from "@/features/profile/useProfile";
import { useFollowStatus, useToggleFollow } from "@/features/social/useFollow";
import { useBlockUser, useReport } from "@/features/social/useBlock";
import { useAuthStore } from "@/state/authStore";

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const viewerId = useAuthStore((s) => s.session?.user.id);

  const { data: profile, isPending } = useProfileByUsername(username);
  const { data: followStatus } = useFollowStatus(profile?.id);
  const toggleFollow = useToggleFollow(profile?.id ?? "");
  const blockUser = useBlockUser(profile?.id ?? "");
  const report = useReport();
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return <EmptyState title="Profile not found" />;
  }

  const isSelf = viewerId === profile.id;
  const followLabel = followStatus === "accepted" ? "Following" : followStatus === "pending" ? "Requested" : "Follow";

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
    >
      <View style={styles.header}>
        <Avatar avatarPath={profile.avatar_path} displayName={profile.display_name} size={72} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Text style={[typeScale.title, { color: colors.textPrimary }]}>{profile.display_name}</Text>
          <Text style={[typeScale.body, { color: colors.textSecondary }]}>@{profile.username}</Text>
        </View>
      </View>

      {profile.bio ? (
        <Text style={[typeScale.body, { color: colors.textPrimary, marginTop: spacing.md }]}>{profile.bio}</Text>
      ) : null}

      <Card style={{ marginTop: spacing.md }}>
        <StatRow>
          <StatBlock label="Activities" value={String(profile.activity_count)} align="center" />
          <StatBlock label="Followers" value={String(profile.followers_count)} align="center" />
          <StatBlock label="Following" value={String(profile.following_count)} align="center" />
        </StatRow>
      </Card>

      {!isSelf ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            label={followLabel}
            variant={followStatus ? "secondary" : "primary"}
            loading={toggleFollow.isPending}
            onPress={() => toggleFollow.mutate(followStatus ?? null)}
          />
          <Button
            label="Block"
            variant="destructive"
            loading={busy}
            onPress={() => {
              Alert.alert("Block this person?", "They won't be able to see your activities or follow you.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Block",
                  style: "destructive",
                  onPress: async () => {
                    setBusy(true);
                    try {
                      await blockUser.mutateAsync();
                    } catch (err) {
                      Alert.alert("Couldn't block", err instanceof Error ? err.message : "Please try again.");
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ]);
            }}
          />
          <Button
            label="Report"
            variant="ghost"
            onPress={() => {
              Alert.alert("Report this profile?", undefined, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Report",
                  onPress: () => report.mutate({ targetType: "profile", targetId: profile.id, reason: "inappropriate" }),
                },
              ]);
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
