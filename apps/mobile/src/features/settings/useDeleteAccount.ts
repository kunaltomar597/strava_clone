import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const response = await fetch(`${env.supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        throw new Error(`Account deletion failed: ${await response.text()}`);
      }

      // The Edge Function has already deleted the auth user server-side;
      // sign out locally to clear the now-invalid session.
      await supabase.auth.signOut();
    },
  });
}
