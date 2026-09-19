import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as KeepAwake from "expo-keep-awake";
import type { SportType } from "@stride/core";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { StatBlock, StatRow } from "@/components/StatBlock";
import { LiveMap } from "@/components/LiveMap";
import { useTheme } from "@/theme/useTheme";
import { spacing, typeScale } from "@/theme/tokens";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { useRecorder } from "@/features/recorder/useRecorder";
import { ExpoLocationSource } from "@/features/recorder/ExpoLocationSource";
import { LOCAL_FLAGS, getFlag, setFlag } from "@/lib/localFlags";

const KEEP_AWAKE_TAG = "record-screen";

const SPORTS: SportType[] = ["run", "ride", "walk", "hike"];

// One instance for the lifetime of the screen; swapping to TransistorSource
// once its license is purchased (Phase 11) means changing only this line.
const locationSource = new ExpoLocationSource();

export default function RecordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const recorder = useRecorder(locationSource);
  const [name, setName] = useState("");
  // Opt-in per the master plan (power-hungry extras default off); useful
  // for a bike mount where the screen would otherwise lock mid-ride.
  const [keepScreenOn, setKeepScreenOn] = useState(false);
  // Map and stats are mutually exclusive rather than layered, so the native
  // map fully unmounts (and stops drawing) while stats-only is shown — the
  // master plan's own battery strategy: "nothing renders in the background".
  const [showMap, setShowMap] = useState(false);
  // One-time nudge toward Settings → Battery optimization, since a fresh
  // install has never seen it; dismissing or following it never shows it
  // again from here (it's always still reachable from Settings).
  const [showBatteryTip, setShowBatteryTip] = useState(
    () => Platform.OS === "android" && !getFlag(LOCAL_FLAGS.seenBatteryGuideTip),
  );

  function dismissBatteryTip() {
    setFlag(LOCAL_FLAGS.seenBatteryGuideTip, true);
    setShowBatteryTip(false);
  }

  const isIdle = recorder.state === "idle";
  const isAcquiring = recorder.state === "acquiring";
  const isRecording = recorder.state === "recording" || recorder.state === "auto_paused";
  const isPaused = recorder.state === "paused";
  const isFinishing = recorder.state === "finishing";

  useEffect(() => {
    if (keepScreenOn && !isIdle && !isFinishing) {
      KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } else {
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
    return () => {
      KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [keepScreenOn, isIdle, isFinishing]);

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
        {showBatteryTip ? (
          <View
            style={[
              styles.tipBanner,
              { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: spacing.lg },
            ]}
          >
            <Text style={[typeScale.body, { color: colors.textPrimary }]}>
              Long recordings can be cut short by your phone's battery saver. Check the recommended setting for
              your device.
            </Text>
            <View style={styles.tipBannerActions}>
              <Button
                label="Not now"
                variant="ghost"
                fullWidth={false}
                onPress={dismissBatteryTip}
              />
              <Button
                label="Show me"
                variant="ghost"
                fullWidth={false}
                onPress={() => {
                  dismissBatteryTip();
                  router.push("/battery-optimization");
                }}
              />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showMap ? (
        <View style={styles.mapContainer}>
          <LiveMap coordinates={recorder.routeCoordinates} />
          <View style={[styles.mapOverlay, { top: insets.top + spacing.md, backgroundColor: colors.surface }]}>
            <StatRow>
              <StatBlock label="Distance" value={formatDistance(recorder.stats?.distanceM ?? 0, "metric")} />
              <StatBlock label="Time" value={formatDuration(recorder.stats?.movingTimeS ?? 0)} />
            </StatRow>
          </View>
        </View>
      ) : (
        <View style={[styles.statsContainer, { paddingTop: insets.top + spacing.lg }]}>
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

          <View style={styles.keepAwakeRow}>
            <Text style={[typeScale.body, { color: colors.textSecondary }]}>Keep screen on</Text>
            <Switch
              value={keepScreenOn}
              onValueChange={setKeepScreenOn}
              accessibilityLabel="Keep screen on while recording"
            />
          </View>

          {recorder.state === "auto_paused" ? (
            <Text style={[typeScale.bodyBold, { color: colors.warning, textAlign: "center", marginTop: spacing.md }]}>
              Auto-paused
            </Text>
          ) : null}

          {recorder.lastGap ? (
            <Text style={[typeScale.caption, { color: colors.warning, textAlign: "center", marginTop: spacing.sm }]}>
              Signal gap detected — about {recorder.lastGap.durationS}s of tracking may be missing.
            </Text>
          ) : null}
        </View>
      )}

      <View
        style={[
          styles.controls,
          { paddingBottom: insets.bottom + spacing.md, backgroundColor: showMap ? colors.background : undefined },
        ]}
      >
        <Button
          label={showMap ? "Show stats" : "Show map"}
          variant="ghost"
          onPress={() => setShowMap((v) => !v)}
        />
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
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  keepAwakeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  tipBanner: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipBannerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: spacing.sm,
  },
  mapContainer: {
    flex: 1,
  },
  mapOverlay: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: 12,
    padding: spacing.sm,
  },
  statsContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
});
