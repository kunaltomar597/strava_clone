import { haversineDistanceM } from "./geo.js";
import type { RawFix, SportType } from "./types.js";

export interface FilterOptions {
  /** Fixes reporting worse horizontal accuracy than this (meters) are dropped. */
  maxAccuracyM: number;
  /** Fixes implying a speed above this (m/s) relative to the last kept fix are dropped. */
  maxPlausibleSpeedMps: number;
}

/** Generous per-sport speed ceilings; a fix implying a faster split is almost certainly noise. */
export const MAX_PLAUSIBLE_SPEED_MPS: Record<SportType, number> = {
  run: 12, // ~2:15/km, well beyond elite pace, with headroom for GPS jitter
  walk: 4,
  hike: 4,
  ride: 30, // ~108 km/h, generous for descents
};

export function defaultFilterOptions(sport: SportType): FilterOptions {
  return {
    maxAccuracyM: 30,
    maxPlausibleSpeedMps: MAX_PLAUSIBLE_SPEED_MPS[sport],
  };
}

/**
 * Drops fixes that are clearly noise: poor accuracy, exact or out-of-order
 * timestamps, and jumps that imply an impossible speed for the sport. Fixes
 * are evaluated against the last *kept* fix within the same segment, so a
 * bad fix does not cascade into rejecting everything after it.
 */
export function filterFixes(fixes: readonly RawFix[], opts: FilterOptions): RawFix[] {
  const kept: RawFix[] = [];
  let lastKeptBySegment = new Map<number, RawFix>();

  for (const fix of fixes) {
    if (fix.hAcc != null && fix.hAcc > opts.maxAccuracyM) continue;

    const last = lastKeptBySegment.get(fix.segment);
    if (last) {
      if (fix.ts <= last.ts) continue;
      const dtS = (fix.ts - last.ts) / 1000;
      const distM = haversineDistanceM(last, fix);
      const impliedSpeed = distM / dtS;
      if (impliedSpeed > opts.maxPlausibleSpeedMps) continue;
    }

    kept.push(fix);
    lastKeptBySegment.set(fix.segment, fix);
  }

  return kept;
}
