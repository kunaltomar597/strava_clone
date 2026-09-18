import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { queryClient } from "@/lib/queryClient";
import { startAuthListener, useAuthStore } from "@/state/authStore";
import { useNeedsOnboarding } from "@/features/auth/useNeedsOnboarding";

void SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const session = useAuthStore((s) => s.session);
  const { needsOnboarding, isLoading: onboardingCheckLoading } = useNeedsOnboarding();

  // Signed in but we don't know yet whether onboarding is needed: keep the
  // splash screen's content hidden rather than flashing the main app and
  // then yanking the user into onboarding a moment later.
  if (session && onboardingCheckLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && needsOnboarding}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !needsOnboarding}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => startAuthListener(), []);

  useEffect(() => {
    if (hasHydrated) {
      void SplashScreen.hideAsync();
    }
  }, [hasHydrated]);

  if (!hasHydrated) {
    // Native splash screen is still showing; render nothing underneath it.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
