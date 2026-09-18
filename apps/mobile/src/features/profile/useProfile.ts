import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

export function useMyProfile() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useProfileByUsername(username: string | undefined) {
  return useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("username", username!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!username,
  });
}

export type ProfileTotalsPeriod = "week" | "month" | "year";

export function useProfileTotals(period: ProfileTotalsPeriod) {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ["profile-totals", userId, period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_profile_totals", {
        p_user_id: userId!,
        p_period: period,
        p_buckets: 12,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (updates: { displayName?: string; bio?: string; isPrivate?: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: updates.displayName,
          bio: updates.bio,
          is_private: updates.isPrivate,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["profile", userId] }),
  });
}
