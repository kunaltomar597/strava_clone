import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { usernameSchema, measurementSystemSchema, type MeasurementSystem } from "@stride/contracts";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/state/authStore";

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [measurementSystem, setMeasurementSystem] = useState<MeasurementSystem>("metric");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(undefined);

    const usernameResult = usernameSchema.safeParse(username.toLowerCase());
    if (!usernameResult.success) {
      setError(usernameResult.error.issues[0]?.message);
      return;
    }
    if (displayName.trim().length === 0) {
      setError("Enter a display name");
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    try {
      const { data: available, error: availError } = await supabase.rpc("is_username_available", {
        check_username: usernameResult.data,
      });
      if (availError) throw availError;
      if (!available) {
        setError("That username is taken");
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ username: usernameResult.data, display_name: displayName.trim() })
        .eq("id", userId);
      if (profileError) throw profileError;

      const { error: settingsError } = await supabase
        .from("user_settings")
        .update({ measurement_system: measurementSystemSchema.parse(measurementSystem) })
        .eq("user_id", userId);
      if (settingsError) throw settingsError;

      await queryClient.invalidateQueries({ queryKey: ["needs-onboarding", userId] });
      await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (err) {
      Alert.alert("Couldn't save profile", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xl }]}>
      <Text style={[typeScale.largeTitle, { color: colors.textPrimary }]}>Welcome</Text>
      <Text style={[typeScale.body, { color: colors.textSecondary, marginTop: spacing.xs }]}>
        Choose a username and let us know your units.
      </Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
        <TextField
          label="Username"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          error={error}
        />
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button
            label="Metric (km)"
            variant={measurementSystem === "metric" ? "primary" : "secondary"}
            fullWidth={false}
            onPress={() => setMeasurementSystem("metric")}
          />
          <Button
            label="Imperial (mi)"
            variant={measurementSystem === "imperial" ? "primary" : "secondary"}
            fullWidth={false}
            onPress={() => setMeasurementSystem("imperial")}
          />
        </View>

        <Button label="Continue" onPress={handleSubmit} loading={submitting} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
