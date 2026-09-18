import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" options={{ headerShown: true, title: "" }} />
      <Stack.Screen name="verify-code" options={{ headerShown: true, title: "Enter code" }} />
    </Stack>
  );
}
