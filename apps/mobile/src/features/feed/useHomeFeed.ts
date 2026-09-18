import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 20;

export type FeedItem = Awaited<ReturnType<typeof fetchPage>>["items"][number];

async function fetchPage(cursor: { beforeTs: string; beforeId: string } | null) {
  const { data, error } = await supabase.rpc("get_home_feed", {
    before_ts: cursor?.beforeTs ?? null,
    before_id: cursor?.beforeId ?? null,
    result_limit: PAGE_SIZE,
  });
  if (error) throw error;

  const items = data ?? [];
  const last = items[items.length - 1];
  const nextCursor = items.length === PAGE_SIZE && last ? { beforeTs: last.started_at, beforeId: last.id } : null;

  return { items, nextCursor };
}

export function useHomeFeed() {
  return useInfiniteQuery({
    queryKey: ["home-feed"],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: null as { beforeTs: string; beforeId: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
