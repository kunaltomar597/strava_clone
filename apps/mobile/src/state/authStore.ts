import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  /** True until the first getSession() resolves — gates the splash screen. */
  isLoading: boolean;
  hasHydrated: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  isLoading: true,
  hasHydrated: false,
}));

let started = false;

/** Call once, near the app root, before rendering anything that reads the session. */
export function startAuthListener(): () => void {
  if (started) return () => {};
  started = true;

  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ session: data.session, isLoading: false, hasHydrated: true });
  });

  const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, isLoading: false, hasHydrated: true });
  });

  return () => {
    subscription.subscription.unsubscribe();
    started = false;
  };
}
