import { EFFORT_DISTANCES_M } from "./types.js";
import type { BestEffort, CleanedPoint, EffortKey } from "./types.js";

/**
 * Finds the fastest continuous effort at each standard distance (400m
 * through marathon) using a two-pointer sliding window over cumulative
 * distance, which is monotonically non-decreasing by construction. For
 * each right endpoint we shrink the window from the left as far as
 * possible while still covering the target distance, then linearly
 * interpolate the exact crossing point so effort times aren't quantized to
 * fix spacing.
 *
 * Elapsed time (not moving time) is used deliberately: a "fastest 5k"
 * should reflect the clock, the same way a race does, so a window that
 * happens to include a stop is correctly penalized and simply won't win.
 */
export function computeBestEfforts(points: readonly CleanedPoint[]): BestEffort[] {
  if (points.length < 2) return [];

  const totalDistanceM = points[points.length - 1]!.cumulativeDistanceM;
  const results: BestEffort[] = [];

  for (const effortKey of Object.keys(EFFORT_DISTANCES_M) as EffortKey[]) {
    const targetM = EFFORT_DISTANCES_M[effortKey];
    if (totalDistanceM < targetM) continue;

    let best: { elapsedTimeS: number; startIdx: number; endIdx: number } | null = null;
    let left = 0;

    for (let right = 0; right < points.length; right++) {
      while (
        left + 1 < right &&
        points[right]!.cumulativeDistanceM - points[left + 1]!.cumulativeDistanceM >= targetM
      ) {
        left++;
      }

      const diff = points[right]!.cumulativeDistanceM - points[left]!.cumulativeDistanceM;
      if (diff < targetM) continue;

      const startTimeS = interpolateStartTimeS(points, left, right, targetM);
      if (startTimeS == null) continue;

      const elapsedTimeS = points[right]!.elapsedTimeS - startTimeS;
      if (elapsedTimeS <= 0) continue;

      if (!best || elapsedTimeS < best.elapsedTimeS) {
        best = { elapsedTimeS, startIdx: left, endIdx: right };
      }
    }

    if (best) {
      results.push({ effortKey, ...best });
    }
  }

  return results;
}

/**
 * Finds the elapsed time at the point exactly `targetM` behind `points[right]`,
 * interpolating between `points[left]` and `points[left + 1]` (or returning
 * `points[left]`'s own time if it lands exactly there).
 */
function interpolateStartTimeS(
  points: readonly CleanedPoint[],
  left: number,
  right: number,
  targetM: number,
): number | null {
  const targetDistanceM = points[right]!.cumulativeDistanceM - targetM;
  const leftPoint = points[left]!;

  if (left + 1 >= points.length || leftPoint.cumulativeDistanceM >= targetDistanceM) {
    return leftPoint.elapsedTimeS;
  }

  const nextPoint = points[left + 1]!;
  const span = nextPoint.cumulativeDistanceM - leftPoint.cumulativeDistanceM;
  if (span <= 0) return leftPoint.elapsedTimeS;

  const frac = (targetDistanceM - leftPoint.cumulativeDistanceM) / span;
  return leftPoint.elapsedTimeS + frac * (nextPoint.elapsedTimeS - leftPoint.elapsedTimeS);
}
