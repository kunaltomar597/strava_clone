import { haversineDistanceM } from "./geo.js";
import type { CleanedPoint, PrivacyZone } from "./types.js";

export interface PrivacyTrimResult {
  visibleFromIdx: number;
  visibleToIdx: number;
}

/**
 * Deterministic pseudo-random in [0, 1) derived from the activity ID, so
 * the same activity always trims the same extra distance (stable across
 * reprocessing) without needing to persist the random value separately.
 */
function stableRandom01(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to an unsigned 32-bit value, then to [0, 1).
  return (hash >>> 0) / 0xffffffff;
}

/**
 * Finds the index range of points that should be *visible* to non-owners,
 * trimming any point within a privacy zone's radius of the activity's
 * start or end. The radius is randomized up to +30% per activity (seeded
 * by activity ID, so it's stable) so that many activities from the same
 * user can't be cross-referenced to triangulate the zone's exact center —
 * a known weakness of naive fixed-radius trimming.
 */
export function computePrivacyWindow(
  points: readonly CleanedPoint[],
  zones: readonly PrivacyZone[],
  activityId: string,
): PrivacyTrimResult {
  if (points.length === 0 || zones.length === 0) {
    return { visibleFromIdx: 0, visibleToIdx: Math.max(0, points.length - 1) };
  }

  const randomFactor = 1 + stableRandom01(activityId) * 0.3;
  const effectiveZones = zones.map((z) => ({ center: z.center, radiusM: z.radiusM * randomFactor }));

  const insideAnyZone = (p: CleanedPoint) =>
    effectiveZones.some((z) => haversineDistanceM(p, z.center) <= z.radiusM);

  let visibleFromIdx = 0;
  while (visibleFromIdx < points.length && insideAnyZone(points[visibleFromIdx]!)) {
    visibleFromIdx++;
  }

  let visibleToIdx = points.length - 1;
  while (visibleToIdx >= visibleFromIdx && insideAnyZone(points[visibleToIdx]!)) {
    visibleToIdx--;
  }

  if (visibleFromIdx > visibleToIdx) {
    // The entire track is inside a privacy zone (e.g. a very short activity
    // that never left home); hide everything rather than show a single point.
    return { visibleFromIdx: 0, visibleToIdx: -1 };
  }

  return { visibleFromIdx, visibleToIdx };
}
