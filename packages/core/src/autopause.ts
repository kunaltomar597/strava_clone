import type { SportType } from "./types.js";

export interface AutoPauseOptions {
  speedThresholdMps: number;
  pauseAfterS: number;
  resumeAfterS: number;
}

export const DEFAULT_AUTO_PAUSE_SPEED_MPS: Record<SportType, number> = {
  run: 0.7,
  walk: 0.4,
  hike: 0.4,
  ride: 1.5,
};

export function defaultAutoPauseOptions(sport: SportType): AutoPauseOptions {
  return {
    speedThresholdMps: DEFAULT_AUTO_PAUSE_SPEED_MPS[sport],
    pauseAfterS: 5,
    resumeAfterS: 3,
  };
}

/**
 * Stateful moving/stopped classifier. Feed it timestamped speed samples in
 * order; it reports whether the activity should be considered "moving" at
 * each sample, debounced so a single slow GPS blip at a red light doesn't
 * flicker the state, and a single fast blip while stopped doesn't either.
 */
export class AutoPauseDetector {
  private moving = true;
  private belowSinceMs: number | null = null;
  private aboveSinceMs: number | null = null;

  constructor(private readonly opts: AutoPauseOptions) {}

  /** @returns true if the sample counts as "moving". */
  update(speedMps: number, ts: number): boolean {
    const isSlow = speedMps < this.opts.speedThresholdMps;

    if (isSlow) {
      this.aboveSinceMs = null;
      if (this.belowSinceMs == null) this.belowSinceMs = ts;
      if (this.moving && ts - this.belowSinceMs >= this.opts.pauseAfterS * 1000) {
        this.moving = false;
      }
    } else {
      this.belowSinceMs = null;
      if (this.aboveSinceMs == null) this.aboveSinceMs = ts;
      if (!this.moving && ts - this.aboveSinceMs >= this.opts.resumeAfterS * 1000) {
        this.moving = true;
      }
    }

    return this.moving;
  }
}

/** Batch variant for server-side reprocessing of a full track. */
export function classifyMoving(
  samples: readonly { speedMps: number; ts: number }[],
  opts: AutoPauseOptions,
): boolean[] {
  const detector = new AutoPauseDetector(opts);
  return samples.map((s) => detector.update(s.speedMps, s.ts));
}
