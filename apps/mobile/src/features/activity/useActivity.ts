import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useActivity(activityId: string | undefined) {
  return useQuery({
    queryKey: ["activity", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select(
          "id, user_id, sport_type, name, description, visibility, map_visibility, started_at, distance_m, elapsed_time_s, moving_time_s, elevation_gain_m, elev_high_m, elev_low_m, avg_speed_mps, max_speed_mps, calories, summary_polyline, splits_metric, kudos_count, comment_count, profiles!activities_user_id_fkey(username, display_name, avatar_path)",
        )
        .eq("id", activityId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activityId,
  });
}

export function useActivityStreams(activityId: string | undefined) {
  return useQuery({
    queryKey: ["activity-streams", activityId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_activity_streams", { p_activity_id: activityId! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!activityId,
  });
}
