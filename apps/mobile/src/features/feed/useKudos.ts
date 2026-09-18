import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";
import type { FeedItem } from "./useHomeFeed";

interface FeedPage {
  items: FeedItem[];
  nextCursor: { beforeTs: string; beforeId: string } | null;
}

/**
 * Optimistic kudos toggle: the UI flips immediately (offline-friendly per
 * the master plan's "kudos and comments apply optimistically offline"),
 * and rolls back only if the write genuinely fails once back online —
 * TanStack Query's mutation retry plus React Query's offline queueing
 * handles the "paused while offline, resumes on reconnect" part for free.
 */
export function useToggleKudos() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async ({ activityId, hasKudoed }: { activityId: string; hasKudoed: boolean }) => {
      if (hasKudoed) {
        const { error } = await supabase.from("kudos").delete().eq("activity_id", activityId);
        if (error) throw error;
      } else {
        if (!userId) throw new Error("Not signed in");
        const { error } = await supabase.from("kudos").insert({ activity_id: activityId, user_id: userId });
        if (error) throw error;
      }
    },
    onMutate: async ({ activityId, hasKudoed }) => {
      await queryClient.cancelQueries({ queryKey: ["home-feed"] });
      const previous = queryClient.getQueryData<InfiniteData<FeedPage>>(["home-feed"]);

      queryClient.setQueryData<InfiniteData<FeedPage>>(["home-feed"], (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === activityId
                ? {
                    ...item,
                    has_kudoed: !hasKudoed,
                    kudos_count: item.kudos_count + (hasKudoed ? -1 : 1),
                  }
                : item,
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["home-feed"], context.previous);
      }
    },
  });
}
