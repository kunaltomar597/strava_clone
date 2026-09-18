import { AutoPauseDetector, type AutoPauseOptions } from "./autopause.js";
import { haversineDistanceM } from "./geo.js";
import { GeoKalmanFilter } from "./kalman.js";
import type { RawFix } from "./types.js";

const ELEVATION_HYSTERESIS_M = 3;
const ELEVATION_SMOOTHING_WINDOW = 5;

/** Incremental counterpart to `computeElevation`'s hysteresis algorithm, O(1) per sample. */
class IncrementalElevation {
  private buffer: number[] = [];
  private anchor: number | null = null;
  private extreme = 0;
  private direction: "up" | "down" | null = null;
  gainM = 0;

  add(altitudeM: number): void {
    this.buffer.push(altitudeM);
    if (this.buffer.length > ELEVATION_SMOOTHING_WINDOW) this.buffer.shift();
    const smoothed = this.buffer.reduce((a, b) => a + b, 0) / this.buffer.length;

    if (this.anchor == null) {
      this.anchor = smoothed;
      this.extreme = smoothed;
      return;
    }

    if (this.direction === null) {
      if (smoothed - this.anchor >= ELEVATION_HYSTERESIS_M) {
        this.direction = "up";
        this.extreme = smoothed;
      } else if (this.anchor - smoothed >= ELEVATION_HYSTERESIS_M) {
        this.direction = "down";
        this.extreme = smoothed;
      }
      return;
    }

    if (this.direction === "up") {
      if (smoothed > this.extreme) {
        this.extreme = smoothed;
      } else if (this.extreme - smoothed >= ELEVATION_HYSTERESIS_M) {
        this.gainM += this.extreme - this.anchor;
        this.anchor = this.extreme;
        this.direction = "down";
        this.extreme = smoothed;
      }
    } else {
      if (smoothed < this.extreme) {
        this.extreme = smoothed;
      } else if (smoothed - this.extreme >= ELEVATION_HYSTERESIS_M) {
        this.anchor = this.extreme;
        this.direction = "up";
        this.extreme = smoothed;
      }
    }
  }
}

export interface LiveStats {
  distanceM: number;
  movingTimeS: number;
  elapsedTimeS: number;
  currentPaceMps: number;
  avgPaceMps: number;
  elevationGainM: number;
  isMoving: boolean;
}

const STATIONARY_JITTER_RADIUS_M = 1.5;
const CURRENT_PACE_WINDOW_MS = 12_000;

/**
 * Window for moving/stopped classification, matching `cleanTrack`'s
 * `CLASSIFICATION_WINDOW_MS`. Position noise is i.i.d. per fix rather than
 * a random walk, so it doesn't compound over a longer baseline the way
 * real movement does — see the longer comment in clean.ts for why this
 * needs to be seconds wide rather than a single 1 Hz step.
 */
const CLASSIFICATION_WINDOW_MS = 5_000;

/**
 * Constant-work-per-point live stats calculator for the Record screen.
 * Unlike `cleanTrack`, this is fully incremental (O(1) per fix, no
 * re-scanning history) so it's cheap to run at 1 Hz on the phone. It
 * intentionally duplicates a subset of `cleanTrack`'s logic rather than
 * sharing state, because live stats and the authoritative server
 * recomputation are allowed to diverge slightly — the server always wins.
 */
export class LiveStatsTracker {
  private readonly kalman: GeoKalmanFilter;
  private readonly autoPause: AutoPauseDetector;
  private startTs: number | null = null;
  private lastSmoothed: { lat: number; lng: number; ts: number } | null = null;
  private recentWindow: Array<{ ts: number; distanceM: number }> = [];
  private classificationWindow: Array<{ ts: number; lat: number; lng: number }> = [];

  private distanceM = 0;
  private movingTimeS = 0;
  private elevation = new IncrementalElevation();
  private isMoving = true;

  constructor(
    private readonly autoPauseOpts: AutoPauseOptions,
    processNoiseMps = 3,
  ) {
    this.kalman = new GeoKalmanFilter(processNoiseMps);
    this.autoPause = new AutoPauseDetector(autoPauseOpts);
  }

  addFix(fix: RawFix): LiveStats {
    if (this.startTs == null) this.startTs = fix.ts;
    const smoothed = this.kalman.process(fix.lat, fix.lng, fix.hAcc ?? 10, fix.ts);
    if (fix.alt != null) this.elevation.add(fix.alt);

    this.classificationWindow.push({ ts: fix.ts, ...smoothed });
    const classificationCutoff = fix.ts - CLASSIFICATION_WINDOW_MS;
    while (this.classificationWindow.length > 1 && this.classificationWindow[0]!.ts < classificationCutoff) {
      this.classificationWindow.shift();
    }
    const oldestInWindow = this.classificationWindow[0]!;
    const classificationDtS = (fix.ts - oldestInWindow.ts) / 1000;
    const classificationSpeedMps =
      classificationDtS > 0 ? haversineDistanceM(oldestInWindow, smoothed) / classificationDtS : 0;
    this.isMoving = this.autoPause.update(classificationSpeedMps, fix.ts);

    if (this.lastSmoothed) {
      const dtS = (fix.ts - this.lastSmoothed.ts) / 1000;
      if (dtS > 0 && this.isMoving) {
        const distM = haversineDistanceM(this.lastSmoothed, smoothed);
        this.movingTimeS += dtS;
        if (distM > STATIONARY_JITTER_RADIUS_M) {
          this.distanceM += distM;
          this.recentWindow.push({ ts: fix.ts, distanceM: distM });
        }
      }
    }

    this.lastSmoothed = { ...smoothed, ts: fix.ts };

    const cutoff = fix.ts - CURRENT_PACE_WINDOW_MS;
    this.recentWindow = this.recentWindow.filter((w) => w.ts >= cutoff);

    return this.snapshot(fix.ts);
  }

  private snapshot(nowTs: number): LiveStats {
    const elapsedTimeS = this.startTs != null ? (nowTs - this.startTs) / 1000 : 0;
    const windowDistanceM = this.recentWindow.reduce((sum, w) => sum + w.distanceM, 0);
    const windowSpanS =
      this.recentWindow.length > 1
        ? (this.recentWindow[this.recentWindow.length - 1]!.ts - this.recentWindow[0]!.ts) / 1000
        : 0;

    return {
      distanceM: this.distanceM,
      movingTimeS: this.movingTimeS,
      elapsedTimeS,
      currentPaceMps: windowSpanS > 0 ? windowDistanceM / windowSpanS : 0,
      avgPaceMps: this.movingTimeS > 0 ? this.distanceM / this.movingTimeS : 0,
      elevationGainM: this.elevation.gainM,
      isMoving: this.isMoving,
    };
  }
}
