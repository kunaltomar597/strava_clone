import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { spacing } from "@/theme/tokens";
import { sendEmailCode } from "@/features/auth/signIn";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});
type FormValues = z.infer<typeof schema>;

export default function SignInScreen() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit({ email }: FormValues) {
    setSending(true);
    try {
      await sendEmailCode(email);
      router.push({ pathname: "/(auth)/verify-code", params: { email } });
    } catch (err) {
      Alert.alert("Couldn't send code", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.email?.message}
          />
        )}
      />
      <Button label="Send code" onPress={handleSubmit(onSubmit)} loading={sending} />
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
