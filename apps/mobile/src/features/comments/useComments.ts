import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

export function useComments(activityId: string | undefined) {
  return useQuery({
    queryKey: ["comments", activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, user_id, body, created_at, edited_at, profiles!comments_user_id_fkey(display_name, avatar_path)")
        .eq("activity_id", activityId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!activityId,
  });
}

export function useAddComment(activityId: string) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (body: string) => {
      if (!userId) throw new Error("Not signed in");
      // Client-generated ID: a retried insert after a dropped response
      // never creates a duplicate comment.
      const id = Crypto.randomUUID();
      const { error } = await supabase.from("comments").insert({ id, activity_id: activityId, user_id: userId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", activityId] });
      void queryClient.invalidateQueries({ queryKey: ["activity", activityId] });
    },
  });
}
