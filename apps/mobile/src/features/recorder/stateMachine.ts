import type { RecordingState } from "./types";

export type RecorderEvent =
  | "OPEN_RECORD"
  | "START"
  | "PAUSE"
  | "RESUME"
  | "AUTO_PAUSE"
  | "AUTO_RESUME"
  | "FINISH"
  | "SAVE"
  | "DISCARD";

/**
 * Pure transition table matching the state diagram in the master plan
 * exactly (section 2). Kept separate from any I/O (GPS, SQLite, network)
 * so it's trivial to reason about and unit-test in isolation; `useRecorder`
 * is the only thing that calls it and performs side effects around it.
 */
const TRANSITIONS: Partial<Record<RecordingState, Partial<Record<RecorderEvent, RecordingState>>>> = {
  idle: { OPEN_RECORD: "acquiring" },
  acquiring: { START: "recording", DISCARD: "discarded" },
  recording: { PAUSE: "paused", AUTO_PAUSE: "auto_paused", FINISH: "finishing" },
  paused: { RESUME: "recording", FINISH: "finishing" },
  auto_paused: { AUTO_RESUME: "recording", PAUSE: "paused", FINISH: "finishing" },
  finishing: { SAVE: "saved", DISCARD: "discarded" },
};

export function nextRecorderState(current: RecordingState, event: RecorderEvent): RecordingState | null {
  return TRANSITIONS[current]?.[event] ?? null;
}

/** GPS must stay on for every state between Acquiring and Finishing, both pause states included. */
export function shouldTrackLocation(state: RecordingState): boolean {
  return state === "acquiring" || state === "recording" || state === "paused" || state === "auto_paused";
}

/** Only true recording time (not a manual pause) should feed distance/time accumulation. */
export function isActivelyRecording(state: RecordingState): boolean {
  return state === "recording" || state === "auto_paused";
}
