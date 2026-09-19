import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Speech from "expo-speech";
import {
  LiveStatsTracker,
  defaultAutoPauseOptions,
  type LatLng,
  type LiveStats,
  type RawFix,
  type SportType,
} from "@stride/core";
import type { RecordingEventContract } from "@stride/contracts";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { appendEvent, appendFixes, createRecording, loadFixes, updateRecordingState } from "./pointWriter";
import { nextRecorderState, shouldTrackLocation, type RecorderEvent } from "./stateMachine";
import type { LocationSource, RecordingState } from "./types";
import { saveAndUploadActivity, type SaveActivityInput } from "./upload";

/** A detected break in fix delivery long enough to matter — surfaced so the UI can tell the user. */
export interface RecordingGap {
  atMs: number;
  durationS: number;
}

/**
 * A gap this much longer than the expected 1Hz cadence is treated as a real
 * interruption (OS throttling, a tunnel, the JS runtime being killed and
 * relaunched) rather than one slow fix — see the mount-recovery effect
 * below for the cold-start case this also catches.
 */
const GAP_THRESHOLD_MS = 15_000;

/** How often the Android live-stats notification text is refreshed while recording; see recordingNotification.ts. */
const NOTIFICATION_UPDATE_INTERVAL_MS = 4000;

export interface UseRecorderResult {
  state: RecordingState;
  sport: SportType;
  stats: LiveStats | null;
  gpsAccuracyM: number | null;
  recordingId: string | null;
  /** The route so far, for LiveMap — grows as fixes arrive, reset on each new recording. */
  routeCoordinates: LatLng[];
  /** The most recent fix-delivery gap detected, or null; auto-clears a few seconds after it's set. */
  lastGap: RecordingGap | null;
  openRecord: (sport: SportType) => Promise<void>;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  save: (input: Omit<SaveActivityInput, "activityId" | "sport">) => Promise<void>;
  discard: () => Promise<void>;
}

export interface UseRecorderOptions {
  /** Announces a split every `splitDistanceM` via expo-speech. Default: on, every 1km. */
  audioCuesEnabled?: boolean;
  splitDistanceM?: number;
}

/**
 * Wires the pure state machine to real I/O: a LocationSource, the local
 * SQLite point writer, and packages/core's LiveStatsTracker for on-screen
 * numbers. This is the only place that does all three at once — the state
 * machine, the recorder UI, and packages/core all stay independently
 * testable.
 */
export function useRecorder(source: LocationSource, options: UseRecorderOptions = {}): UseRecorderResult {
  const { audioCuesEnabled = true, splitDistanceM = 1000 } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [sport, setSport] = useState<SportType>("run");
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LatLng[]>([]);
  const [lastGap, setLastGap] = useState<RecordingGap | null>(null);

  const trackerRef = useRef<LiveStatsTracker | null>(null);
  const seqRef = useRef(0);
  const eventSeqRef = useRef(0);
  const eventsRef = useRef<RecordingEventContract[]>([]);
  const stateRef = useRef<RecordingState>("idle");
  stateRef.current = state;
  const nextSplitBoundaryRef = useRef(splitDistanceM);
  const lastSplitMovingTimeSRef = useRef(0);
  const lastFixTsRef = useRef<number | null>(null);
  const lastNotificationUpdateAtRef = useRef(0);

  const dispatch = useCallback((event: RecorderEvent) => {
    setState((current) => nextRecorderState(current, event) ?? current);
  }, []);

  const logEvent = useCallback(async (type: RecordingEventContract["type"]) => {
    if (!recordingId) return;
    const seq = eventSeqRef.current++;
    const ts = Date.now();
    eventsRef.current.push({ seq, ts, type });
    await appendEvent(recordingId, seq, type as RecorderEvent);
  }, [recordingId]);

  const openRecord = useCallback(
    async (selectedSport: SportType) => {
      const id = Crypto.randomUUID();
      setSport(selectedSport);
      setRecordingId(id);
      setRouteCoordinates([]);
      trackerRef.current = new LiveStatsTracker(defaultAutoPauseOptions(selectedSport));
      seqRef.current = 0;
      eventSeqRef.current = 0;
      eventsRef.current = [];
      nextSplitBoundaryRef.current = splitDistanceM;
      lastSplitMovingTimeSRef.current = 0;
      lastFixTsRef.current = null;
      lastNotificationUpdateAtRef.current = 0;
      setLastGap(null);
      await createRecording(id, selectedSport, Date.now());
      dispatch("OPEN_RECORD");
      await source.start(selectedSport);
    },
    [source, dispatch, splitDistanceM],
  );

  const start = useCallback(async () => {
    dispatch("START");
    await logEvent("start");
  }, [dispatch, logEvent]);

  const pause = useCallback(async () => {
    dispatch("PAUSE");
    await logEvent("pause");
    await source.updateNotificationText("Paused");
  }, [dispatch, logEvent, source]);

  const resume = useCallback(async () => {
    dispatch("RESUME");
    await logEvent("resume");
  }, [dispatch, logEvent]);

  const finish = useCallback(async () => {
    dispatch("FINISH");
    await logEvent("stop");
    await source.stop();
    if (recordingId) {
      await updateRecordingState(recordingId, "finishing", Date.now());
    }
  }, [dispatch, logEvent, source, recordingId]);

  const discard = useCallback(async () => {
    // Reachable either before the recording ever started (from "acquiring",
    // e.g. the user backs out of "choose a sport") or after finish() has
    // already stopped the source — calling stop() again there is a no-op,
    // but skipping it in the first case would leave GPS and the Android
    // notification running with nothing to show for it.
    await source.stop();
    dispatch("DISCARD");
  }, [dispatch, source]);

  const save = useCallback(
    async (input: Omit<SaveActivityInput, "activityId" | "sport">) => {
      if (!recordingId) throw new Error("No active recording");
      await saveAndUploadActivity({ ...input, activityId: recordingId, sport }, eventsRef.current);
      dispatch("SAVE");
    },
    [recordingId, sport, dispatch],
  );

  // At mount (covers "still open at launch" recovery per section 2): if a
  // fix arrives while the tracker hasn't been (re)hydrated with whatever
  // this recording already has on disk, reconcile from SQLite first.
  useEffect(() => {
    if (!recordingId) return;
    let cancelled = false;
    void loadFixes(recordingId).then((existing) => {
      if (cancelled || existing.length === 0 || !trackerRef.current) return;
      for (const fix of existing) {
        trackerRef.current.addFix(fix);
      }
      seqRef.current = existing.length;
      // The next live fix's gap-from-previous is measured against this —
      // exactly what catches "the app was killed and just relaunched into
      // an in-progress recording" as a reportable gap, not silently.
      lastFixTsRef.current = existing[existing.length - 1]!.ts;
    });
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  useEffect(() => {
    const unsubscribe = source.onFix((fix: RawFix) => {
      if (!trackerRef.current || !recordingId) return;
      if (!shouldTrackLocation(stateRef.current)) return;

      const previousFixTs = lastFixTsRef.current;
      lastFixTsRef.current = fix.ts;
      if (previousFixTs != null) {
        const gapMs = fix.ts - previousFixTs;
        if (gapMs > GAP_THRESHOLD_MS) {
          void logEvent("gap");
          setLastGap({ atMs: Date.now(), durationS: Math.round(gapMs / 1000) });
        }
      }

      const snapshot = trackerRef.current.addFix(fix);
      setStats(snapshot);
      setGpsAccuracyM(fix.hAcc ?? null);
      setRouteCoordinates((prev) => [...prev, { lat: fix.lat, lng: fix.lng }]);

      const now = Date.now();
      if (now - lastNotificationUpdateAtRef.current >= NOTIFICATION_UPDATE_INTERVAL_MS) {
        lastNotificationUpdateAtRef.current = now;
        void source.updateNotificationText(
          `${formatDistance(snapshot.distanceM, "metric")} · ${formatDuration(snapshot.movingTimeS)}`,
        );
      }

      if (audioCuesEnabled && snapshot.distanceM >= nextSplitBoundaryRef.current) {
        const splitTimeS = snapshot.movingTimeS - lastSplitMovingTimeSRef.current;
        const splitNumber = Math.round(nextSplitBoundaryRef.current / splitDistanceM);
        const splitSpeedMps = splitTimeS > 0 ? splitDistanceM / splitTimeS : 0;
        lastSplitMovingTimeSRef.current = snapshot.movingTimeS;
        nextSplitBoundaryRef.current += splitDistanceM;
        // Speaks over whatever's playing rather than pausing it, but expo-speech
        // has no explicit "duck" option — on iOS this may briefly interrupt
        // music depending on the other app's audio session category.
        Speech.speak(`Split ${splitNumber}: ${formatDuration(splitTimeS)}, ${formatPace(splitSpeedMps, "metric")}`);
      }

      const seq = seqRef.current++;
      void appendFixes(recordingId, seq, [fix]);

      setState((current) => {
        if (current === "recording" && !snapshot.isMoving) return "auto_paused";
        if (current === "auto_paused" && snapshot.isMoving) return "recording";
        return current;
      });
    });
    return unsubscribe;
  }, [source, recordingId, audioCuesEnabled, splitDistanceM, logEvent]);

  useEffect(() => {
    if (!lastGap) return;
    const timeout = setTimeout(() => setLastGap(null), 8000);
    return () => clearTimeout(timeout);
  }, [lastGap]);

  return {
    state,
    sport,
    stats,
    gpsAccuracyM,
    recordingId,
    routeCoordinates,
    lastGap,
    openRecord,
    start,
    pause,
    resume,
    finish,
    save,
    discard,
  };
}
