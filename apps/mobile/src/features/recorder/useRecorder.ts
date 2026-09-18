import { useCallback, useEffect, useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import * as Speech from "expo-speech";
import {
  LiveStatsTracker,
  defaultAutoPauseOptions,
  type LiveStats,
  type RawFix,
  type SportType,
} from "@stride/core";
import type { RecordingEventContract } from "@stride/contracts";
import { formatDuration, formatPace } from "@/lib/format";
import { appendEvent, appendFixes, createRecording, loadFixes, updateRecordingState } from "./pointWriter";
import { nextRecorderState, shouldTrackLocation, type RecorderEvent } from "./stateMachine";
import type { LocationSource, RecordingState } from "./types";
import { saveAndUploadActivity, type SaveActivityInput } from "./upload";

export interface UseRecorderResult {
  state: RecordingState;
  sport: SportType;
  stats: LiveStats | null;
  gpsAccuracyM: number | null;
  recordingId: string | null;
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

  const trackerRef = useRef<LiveStatsTracker | null>(null);
  const seqRef = useRef(0);
  const eventSeqRef = useRef(0);
  const eventsRef = useRef<RecordingEventContract[]>([]);
  const stateRef = useRef<RecordingState>("idle");
  stateRef.current = state;
  const nextSplitBoundaryRef = useRef(splitDistanceM);
  const lastSplitMovingTimeSRef = useRef(0);

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
      trackerRef.current = new LiveStatsTracker(defaultAutoPauseOptions(selectedSport));
      seqRef.current = 0;
      eventSeqRef.current = 0;
      eventsRef.current = [];
      nextSplitBoundaryRef.current = splitDistanceM;
      lastSplitMovingTimeSRef.current = 0;
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
  }, [dispatch, logEvent]);

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
    dispatch("DISCARD");
  }, [dispatch]);

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
    });
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  useEffect(() => {
    const unsubscribe = source.onFix((fix: RawFix) => {
      if (!trackerRef.current || !recordingId) return;
      if (!shouldTrackLocation(stateRef.current)) return;

      const snapshot = trackerRef.current.addFix(fix);
      setStats(snapshot);
      setGpsAccuracyM(fix.hAcc ?? null);

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
  }, [source, recordingId, audioCuesEnabled, splitDistanceM]);

  return { state, sport, stats, gpsAccuracyM, recordingId, openRecord, start, pause, resume, finish, save, discard };
}
