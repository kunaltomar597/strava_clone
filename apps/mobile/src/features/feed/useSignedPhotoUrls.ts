import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const SIGNED_URL_TTL_S = 60 * 60; // 1 hour; expo-image caches by storage path, not by URL, so re-signing is cheap.

/**
 * activity-photos is a private bucket (read access mirrors
 * can_view_activity via RLS on storage.objects), so a raw object URL
 * never works — every photo needs its own signed URL from the Storage API.
 */
export function useSignedPhotoUrls(paths: readonly string[]) {
  return useQuery({
    queryKey: ["signed-photo-urls", ...paths],
    queryFn: async () => {
      if (paths.length === 0) return {} as Record<string, string>;
      const { data, error } = await supabase.storage
        .from("activity-photos")
        .createSignedUrls([...paths], SIGNED_URL_TTL_S);
      if (error) throw error;

      const map: Record<string, string> = {};
      for (const entry of data) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
    enabled: paths.length > 0,
    staleTime: (SIGNED_URL_TTL_S - 60) * 1000,
  });
}
