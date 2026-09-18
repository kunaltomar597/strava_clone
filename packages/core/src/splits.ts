import type { CleanedPoint, Split } from "./types.js";

const METERS_PER_MILE = 1609.344;

/**
 * Splits at every `intervalM` of distance (1000 for metric, 1609.344 for
 * imperial). The boundary crossing is linearly interpolated between the two
 * surrounding points, so split times are not quantized to fix intervals.
 */
export function computeSplits(points: readonly CleanedPoint[], intervalM: number): Split[] {
  if (points.length < 2) return [];

  const splits: Split[] = [];
  let splitStartDistanceM = 0;
  let splitStartMovingTimeS = points[0]!.cumulativeMovingTimeS;
  let splitStartElapsedTimeS = points[0]!.elapsedTimeS;
  let splitStartElevationM = points[0]!.alt ?? 0;
  let nextBoundary = intervalM;
  let index = 1;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;

    while (curr.cumulativeDistanceM >= nextBoundary) {
      const distBefore = prev.cumulativeDistanceM;
      const distAfter = curr.cumulativeDistanceM;
      const frac = distAfter > distBefore ? (nextBoundary - distBefore) / (distAfter - distBefore) : 0;

      const movingTimeS =
        prev.cumulativeMovingTimeS + frac * (curr.cumulativeMovingTimeS - prev.cumulativeMovingTimeS) - splitStartMovingTimeS;
      const elapsedTimeS =
        prev.elapsedTimeS + frac * (curr.elapsedTimeS - prev.elapsedTimeS) - splitStartElapsedTimeS;
      const elevation = prev.alt != null && curr.alt != null ? prev.alt + frac * (curr.alt - prev.alt) : (curr.alt ?? splitStartElevationM);
      const elevationGainM = Math.max(0, elevation - splitStartElevationM);
      const distanceM = nextBoundary - splitStartDistanceM;

      splits.push({
        index: index++,
        distanceM,
        movingTimeS: Math.max(0, movingTimeS),
        elapsedTimeS: Math.max(0, elapsedTimeS),
        elevationGainM,
        avgSpeedMps: movingTimeS > 0 ? distanceM / movingTimeS : 0,
      });

      splitStartDistanceM = nextBoundary;
      splitStartMovingTimeS += movingTimeS;
      splitStartElapsedTimeS += elapsedTimeS;
      splitStartElevationM = elevation;
      nextBoundary += intervalM;
    }
  }

  // Final partial split, if any meaningful distance remains.
  const last = points[points.length - 1]!;
  const remainingDistanceM = last.cumulativeDistanceM - splitStartDistanceM;
  if (remainingDistanceM > 1) {
    const movingTimeS = last.cumulativeMovingTimeS - splitStartMovingTimeS;
    const elapsedTimeS = last.elapsedTimeS - splitStartElapsedTimeS;
    splits.push({
      index: index++,
      distanceM: remainingDistanceM,
      movingTimeS: Math.max(0, movingTimeS),
      elapsedTimeS: Math.max(0, elapsedTimeS),
      elevationGainM: Math.max(0, (last.alt ?? splitStartElevationM) - splitStartElevationM),
      avgSpeedMps: movingTimeS > 0 ? remainingDistanceM / movingTimeS : 0,
    });
  }

  return splits;
}

export function computeMetricSplits(points: readonly CleanedPoint[]): Split[] {
  return computeSplits(points, 1000);
}

export function computeImperialSplits(points: readonly CleanedPoint[]): Split[] {
  return computeSplits(points, METERS_PER_MILE);
}
