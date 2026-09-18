import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

/**
 * handle_new_user gives every new account a placeholder username shaped
 * like `user_<20 hex chars>` (see the migration). Still having one is a
 * reliable, server-truthful signal that onboarding (claiming a real
 * username) hasn't happened yet — no separate "onboarded" column needed.
 */
const PLACEHOLDER_USERNAME_RE = /^user_[0-9a-f]{20}$/;

export function useNeedsOnboarding(): { needsOnboarding: boolean; isLoading: boolean } {
  const userId = useAuthStore((s) => s.session?.user.id);

  const query = useQuery({
    queryKey: ["needs-onboarding", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("username").eq("id", userId!).single();
      if (error) throw error;
      return PLACEHOLDER_USERNAME_RE.test(data.username);
    },
    enabled: !!userId,
  });

  return { needsOnboarding: query.data ?? false, isLoading: userId != null && query.isPending };
}
