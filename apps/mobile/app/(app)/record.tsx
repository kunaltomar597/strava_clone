import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SportType } from "@stride/core";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { StatBlock, StatRow } from "@/components/StatBlock";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { useRecorder } from "@/features/recorder/useRecorder";
import { ExpoLocationSource } from "@/features/recorder/ExpoLocationSource";

const SPORTS: SportType[] = ["run", "ride", "walk", "hike"];

// One instance for the lifetime of the screen; swapping to TransistorSource
// once its license is purchased (Phase 11) means changing only this line.
const locationSource = new ExpoLocationSource();

export default function RecordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const recorder = useRecorder(locationSource);
  const [name, setName] = useState("");

  const isIdle = recorder.state === "idle";
  const isAcquiring = recorder.state === "acquiring";
  const isRecording = recorder.state === "recording" || recorder.state === "auto_paused";
  const isPaused = recorder.state === "paused";
  const isFinishing = recorder.state === "finishing";

  const canStart = isAcquiring && recorder.gpsAccuracyM != null && recorder.gpsAccuracyM <= 20;

  const defaultTitle = useMemo(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
    const sportLabel = recorder.sport.charAt(0).toUpperCase() + recorder.sport.slice(1);
    return `${timeOfDay} ${sportLabel}`;
  }, [recorder.sport]);

  if (isFinishing) {
    return (
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: insets.top + spacing.lg }}
      >
        <Text style={[typeScale.title, { color: colors.textPrimary }]}>Save activity</Text>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <TextField label="Title" value={name || defaultTitle} onChangeText={setName} />
          <Button
            label="Save & upload"
            onPress={async () => {
              try {
                await recorder.save({
                  name: name || defaultTitle,
                  visibility: "followers",
                  mapVisibility: "hide_start_end",
                  startedAt: new Date().toISOString(),
                  startTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                });
              } catch (err) {
                Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
              }
            }}
          />
          <Button label="Discard" variant="destructive" onPress={() => void recorder.discard()} />
        </View>
      </ScrollView>
    );
  }

  if (isIdle) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={[typeScale.title, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          Choose a sport
        </Text>
        <View style={{ gap: spacing.sm, width: "100%", paddingHorizontal: spacing.lg }}>
          {SPORTS.map((sport) => (
            <Button
              key={sport}
              label={sport.charAt(0).toUpperCase() + sport.slice(1)}
              variant="secondary"
              onPress={() => void recorder.openRecord(sport)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg }]}>
      {isAcquiring ? (
        <Text style={[typeScale.body, { color: colors.textSecondary, textAlign: "center" }]}>
          {recorder.gpsAccuracyM == null
            ? "Acquiring GPS signal…"
            : `Accuracy: ${Math.round(recorder.gpsAccuracyM)}m — ${canStart ? "ready to start" : "getting a better fix…"}`}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        <StatBlock
          label="Distance"
          value={formatDistance(recorder.stats?.distanceM ?? 0, "metric")}
          align="center"
        />
      </View>
      <StatRow>
        <StatBlock label="Time" value={formatDuration(recorder.stats?.movingTimeS ?? 0)} />
        <StatBlock label="Pace" value={formatPace(recorder.stats?.avgPaceMps ?? 0, "metric")} />
      </StatRow>

      {recorder.state === "auto_paused" ? (
        <Text style={[typeScale.bodyBold, { color: colors.warning, textAlign: "center", marginTop: spacing.md }]}>
          Auto-paused
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.xxl, gap: spacing.sm }}>
        {isAcquiring ? (
          <Button label="Start" onPress={() => void recorder.start()} disabled={!canStart} />
        ) : isPaused ? (
          <>
            <Button label="Resume" onPress={() => void recorder.resume()} />
            <Button label="Finish" variant="secondary" onPress={() => void recorder.finish()} />
          </>
        ) : isRecording ? (
          <>
            <Button label="Pause" onPress={() => void recorder.pause()} />
            <Button label="Finish" variant="secondary" onPress={() => void recorder.finish()} />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
