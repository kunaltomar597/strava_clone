import { RefreshControl } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityCard } from "@/components/ActivityCard";
import { EmptyState } from "@/components/EmptyState";
import { useHomeFeed } from "@/features/feed/useHomeFeed";
import { useToggleKudos } from "@/features/feed/useKudos";
import { useTheme } from "@/theme/useTheme";
import { spacing } from "@/theme/tokens";
import type { FeedItem } from "@/features/feed/useHomeFeed";

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const feed = useHomeFeed();
  const toggleKudos = useToggleKudos();

  const items: FeedItem[] = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlashList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xl,
      }}
      style={{ backgroundColor: colors.background }}
      renderItem={({ item }) => (
        <ActivityCard
          activity={item}
          onPress={() => router.push(`/activity/${item.id}`)}
          onToggleKudos={() => toggleKudos.mutate({ activityId: item.id, hasKudoed: item.has_kudoed })}
        />
      )}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) {
          void feed.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        !feed.isPending ? (
          <EmptyState
            title="No activities yet"
            message="Follow people, or record your first activity, to see it here."
          />
        ) : null
      }
    />
  );
}
