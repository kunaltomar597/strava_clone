import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

export function usePrivacyZones() {
  const userId = useAuthStore((s) => s.session?.user.id);

  return useQuery({
    queryKey: ["privacy-zones", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("privacy_zones").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useAddPrivacyZone() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (input: { label: string; lat: number; lng: number; radiusM: number }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("privacy_zones").insert({
        user_id: userId,
        label: input.label,
        center: { type: "Point", coordinates: [input.lng, input.lat] },
        radius_m: input.radiusM,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["privacy-zones", userId] }),
  });
}

export function useDeletePrivacyZone() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("privacy_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["privacy-zones", userId] }),
  });
}
