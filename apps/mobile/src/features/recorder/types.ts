import type { RawFix, SportType } from "@stride/core";

export type RecordingState =
  | "idle"
  | "acquiring"
  | "recording"
  | "paused"
  | "auto_paused"
  | "finishing"
  | "saved"
  | "discarded";

export type RecordingEventType =
  | "start"
  | "pause"
  | "resume"
  | "auto_pause"
  | "auto_resume"
  | "lap"
  | "gap"
  | "stop";

export interface RecorderStatus {
  isTracking: boolean;
  lastFixAt: number | null;
  /** Horizontal accuracy of the most recent fix, in meters. */
  lastAccuracyM: number | null;
}

/**
 * The interface every recording engine implements — TransistorSource in
 * production, ReplaySource for tests/simulators, and (per the master
 * plan's fallback) ExpoLocationSource where the commercial SDK isn't
 * available. The recorder, state machine and UI depend only on this, so
 * swapping the engine never touches the rest of the recording feature.
 */
export interface LocationSource {
  /** Begin GPS acquisition/tracking in "workout mode" (see section 2 of the master plan). */
  start(sport: SportType): Promise<void>;
  stop(): Promise<void>;
  /** Fires for every fix the source captures, in the foreground. */
  onFix(listener: (fix: RawFix) => void): () => void;
  /** Fixes persisted by the source's own native store while the app was backgrounded or killed. */
  readPersistedFixes(sinceTs: number): Promise<RawFix[]>;
  clearPersistedFixes(): Promise<void>;
  /** Updates the Android foreground-service / iOS Live Activity text, e.g. "5.2 km · 28:14". */
  updateNotificationText(text: string): Promise<void>;
  getStatus(): Promise<RecorderStatus>;
}
