import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

/** Personal records only (pr_rank = 1), newest first — one row per distance the user has ever run/ridden. */
export function useBestEfforts() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ["best-efforts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("best_efforts")
        .select("id, activity_id, effort_key, elapsed_time_s, pr_rank, activities!best_efforts_activity_id_fkey(name, started_at)")
        .eq("user_id", userId!)
        .eq("pr_rank", 1)
        .order("effort_key");
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
