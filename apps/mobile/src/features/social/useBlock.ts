import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReportTargetType } from "@stride/contracts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

export function useBlockUser(targetUserId: string) {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async () => {
      if (!viewerId) throw new Error("Not signed in");
      const { error } = await supabase.from("blocks").insert({ blocker_id: viewerId, blocked_id: targetUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["home-feed"] });
      void queryClient.invalidateQueries({ queryKey: ["follow-status"] });
    },
  });
}

export function useReport() {
  return useMutation({
    mutationFn: async (input: { targetType: ReportTargetType; targetId: string; reason: string; details?: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason: input.reason,
        details: input.details ?? null,
      });
      if (error) throw error;
    },
  });
}
