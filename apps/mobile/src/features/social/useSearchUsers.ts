import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["search-users", query],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_users", { p_query: query, result_limit: 30 });
      if (error) throw error;
      return data;
    },
    enabled: query.trim().length > 0,
  });
}
