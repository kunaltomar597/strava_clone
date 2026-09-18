import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { useMarkNotificationsRead, useNotifications } from "@/features/notifications/useNotifications";
import { useAcceptFollowRequest } from "@/features/social/useFollow";

const MESSAGE: Record<string, string> = {
  kudos: "gave you kudos",
  comment: "commented on your activity",
  follow: "started following you",
  follow_request: "wants to follow you",
  follow_accepted: "accepted your follow request",
  personal_record: "You just set a new personal record",
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const acceptFollow = useAcceptFollowRequest();

  useEffect(() => {
    const unread = (notifications ?? []).filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length > 0) markRead.mutate(unread);
    // Deliberately keyed on `notifications` only, not `markRead` (a new
    // mutation object identity each render would otherwise re-fire this).
  }, [notifications]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + spacing.md }}>
      <FlashList
        data={notifications ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md }}
        renderItem={({ item }) => {
          const actor = item.actor as unknown as { display_name: string; avatar_path: string | null } | null;
          return (
            <Pressable
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm }}
              onPress={() => {
                if (item.activity_id) router.push(`/activity/${item.activity_id}`);
              }}
            >
              <Avatar avatarPath={actor?.avatar_path ?? null} displayName={actor?.display_name ?? "?"} size={40} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={[typeScale.body, { color: colors.textPrimary }]}>
                  <Text style={typeScale.bodyBold}>{actor?.display_name}</Text> {MESSAGE[item.type] ?? item.type}
                </Text>
                <Text style={[typeScale.caption, { color: colors.textSecondary }]}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
                {item.type === "follow_request" ? (
                  <View style={{ marginTop: spacing.xs, width: 120 }}>
                    <Button
                      label="Accept"
                      variant="secondary"
                      onPress={() => acceptFollow.mutate(item.actor_id)}
                    />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<EmptyState title="No notifications yet" />}
      />
    </View>
  );
}
