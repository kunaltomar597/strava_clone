import { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { signInWithApple, signInWithGoogle } from "@/features/auth/signIn";

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  async function handleApple() {
    setLoading("apple");
    try {
      await signInWithApple();
    } catch (err) {
      if ((err as { code?: string }).code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign-in failed", err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    setLoading("google");
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert("Sign-in failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xxl }]}>
      <View style={styles.hero}>
        <Text style={[typeScale.largeTitle, { color: colors.textPrimary }]}>Stride</Text>
        <Text style={[typeScale.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
          Track your runs, rides, walks and hikes.
        </Text>
      </View>

      <View style={{ paddingBottom: insets.bottom + spacing.lg, gap: spacing.sm }}>
        {appleAvailable && (
          <Button label="Continue with Apple" onPress={handleApple} loading={loading === "apple"} />
        )}
        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={handleGoogle}
          loading={loading === "google"}
        />
        <Button
          label="Continue with email"
          variant="ghost"
          onPress={() => router.push("/(auth)/sign-in")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  hero: {
    paddingTop: spacing.xxl,
  },
});
