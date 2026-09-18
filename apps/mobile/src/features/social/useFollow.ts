import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

export function useFollowStatus(targetUserId: string | undefined) {
  const viewerId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ["follow-status", viewerId, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("status")
        .eq("follower_id", viewerId!)
        .eq("followee_id", targetUserId!)
        .maybeSingle();
      if (error) throw error;
      return data?.status ?? null;
    },
    enabled: !!viewerId && !!targetUserId && viewerId !== targetUserId,
  });
}

export function useToggleFollow(targetUserId: string) {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (currentStatus: "pending" | "accepted" | null) => {
      if (!viewerId) throw new Error("Not signed in");
      if (currentStatus) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", viewerId)
          .eq("followee_id", targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: viewerId, followee_id: targetUserId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["follow-status", viewerId, targetUserId] });
      void queryClient.invalidateQueries({ queryKey: ["profile-by-username"] });
    },
  });
}

/** Accepts an incoming follow request — the followee's own action, from a `follow_request` notification. */
export function useAcceptFollowRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (followerId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("follows")
        .update({ status: "accepted" })
        .eq("follower_id", followerId)
        .eq("followee_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
