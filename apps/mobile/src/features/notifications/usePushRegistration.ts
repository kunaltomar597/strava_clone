import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

/**
 * Registers this device's Expo push token once signed in. Notification
 * permission is requested here too — per section 2's onboarding order,
 * a real app would show a primer screen first; this is the mechanical
 * half (the actual system prompt + token registration).
 */
export function usePushRegistration(): void {
  const userId = useAuthStore((s) => s.session?.user.id);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted" || cancelled) return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (cancelled) return;

      await supabase.from("push_tokens").upsert(
        {
          user_id: userId,
          token: token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        },
        { onConflict: "token" },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);
}
