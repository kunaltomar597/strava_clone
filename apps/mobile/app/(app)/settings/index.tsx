import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { useMyProfile, useUpdateProfile } from "@/features/profile/useProfile";
import { useAddPrivacyZone, useDeletePrivacyZone, usePrivacyZones } from "@/features/settings/usePrivacyZones";
import { useDeleteAccount } from "@/features/settings/useDeleteAccount";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateProfile();
  const { data: zones } = usePrivacyZones();
  const addZone = useAddPrivacyZone();
  const deleteZone = useDeletePrivacyZone();
  const deleteAccount = useDeleteAccount();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [addingZone, setAddingZone] = useState(false);

  async function handleAddZoneAtCurrentLocation() {
    setAddingZone(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert("Location permission needed", "Allow location access to add a privacy zone here.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      await addZone.mutateAsync({
        label: "Home",
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        radiusM: 400,
      });
    } catch (err) {
      Alert.alert("Couldn't add privacy zone", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setAddingZone(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl }}
    >
      <Text style={[typeScale.largeTitle, { color: colors.textPrimary }]}>Settings</Text>

      <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.lg }]}>Profile</Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        <TextField label="Bio" value={bio} onChangeText={setBio} multiline maxLength={280} />
        <View style={styles.switchRow}>
          <Text style={[typeScale.body, { color: colors.textPrimary }]}>Private account</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} />
        </View>
        <Button
          label="Save profile"
          loading={updateProfile.isPending}
          onPress={() => updateProfile.mutate({ displayName, bio, isPrivate })}
        />
      </View>

      <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.xl }]}>Privacy zones</Text>
      <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
        Hides the start and end of your activities near these locations.
      </Text>
      <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
        {(zones ?? []).map((zone) => (
          <View key={zone.id} style={styles.zoneRow}>
            <Text style={[typeScale.body, { color: colors.textPrimary }]}>
              {zone.label} ({zone.radius_m}m)
            </Text>
            <Button label="Remove" variant="ghost" fullWidth={false} onPress={() => deleteZone.mutate(zone.id)} />
          </View>
        ))}
        <Button label="Add zone at current location" variant="secondary" loading={addingZone} onPress={handleAddZoneAtCurrentLocation} />
      </View>

      {Platform.OS === "android" ? (
        <>
          <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.xl }]}>Recording</Text>
          <Text style={[typeScale.caption, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            Some phone makers stop background apps aggressively, which can cut a recording short.
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <Button
              label="Battery optimization"
              variant="secondary"
              onPress={() => router.push("/battery-optimization")}
            />
          </View>
        </>
      ) : null}

      <Text style={[typeScale.title, { color: colors.textPrimary, marginTop: spacing.xl }]}>Account</Text>
      <View style={{ marginTop: spacing.sm }}>
        <Button
          label="Delete account"
          variant="destructive"
          onPress={() => {
            Alert.alert(
              "Delete your account?",
              "This permanently deletes your account, activities, and photos. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteAccount.mutateAsync();
                      router.replace("/");
                    } catch (err) {
                      Alert.alert("Couldn't delete account", err instanceof Error ? err.message : "Please try again.");
                    }
                  },
                },
              ],
            );
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  zoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
