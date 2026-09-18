import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { sendEmailCode, verifyEmailCode } from "@/features/auth/signIn";

export default function VerifyCodeScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    try {
      await verifyEmailCode(email, code);
      // Navigation away happens automatically: authStore's session update
      // flips the root layout's Stack.Protected guard.
    } catch (err) {
      Alert.alert("Invalid code", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      await sendEmailCode(email);
    } catch (err) {
      Alert.alert("Couldn't resend code", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={[typeScale.body, { color: colors.textSecondary }]}>
        We sent a 6-digit code to {email}.
      </Text>
      <TextField
        label="Code"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChangeText={setCode}
      />
      <Button label="Verify" onPress={handleVerify} loading={verifying} disabled={code.length !== 6} />
      <Button label="Resend code" variant="ghost" onPress={handleResend} loading={resending} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
