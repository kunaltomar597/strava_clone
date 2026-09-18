import { classifyMoving, type AutoPauseOptions } from "./autopause.js";
import { haversineDistanceM } from "./geo.js";
import { GeoKalmanFilter } from "./kalman.js";
import type { CleanedPoint, RawFix } from "./types.js";

const STATIONARY_JITTER_RADIUS_M = 1.5;

/**
 * Window used to classify moving/stopped. At 1 Hz, a single sample's
 * displacement is the same order of magnitude as GPS position noise
 * itself, so instantaneous per-step "speed" cannot distinguish a person
 * standing still from one walking slowly — both look like ~1-2 m/s.
 * Position noise is i.i.d. per fix rather than a random walk, though, so
 * it does not compound with a longer baseline: net displacement over a
 * multi-second window still carries roughly one sample's worth of noise,
 * while real movement accumulates linearly with the window. A wider
 * window therefore has a far better signal-to-noise ratio for
 * classification, at the cost of reacting a little slower to genuine
 * stops — which the auto-pause debounce (`pauseAfterS`/`resumeAfterS`)
 * already expects and absorbs.
 */
const CLASSIFICATION_WINDOW_MS = 5000;

interface SmoothedFix {
  lat: number;
  lng: number;
  fix: RawFix;
}

/**
 * Net-displacement speed over a trailing `windowMs` window ending at each
 * point (shorter at the start of the track), via a sliding two-pointer
 * over the already-smoothed positions.
 */
function computeWindowedSpeeds(smoothed: readonly SmoothedFix[], windowMs: number): number[] {
  const speeds = new Array<number>(smoothed.length).fill(0);
  let left = 0;

  for (let i = 0; i < smoothed.length; i++) {
    const cutoff = smoothed[i]!.fix.ts - windowMs;
    while (left < i && smoothed[left]!.fix.ts < cutoff) left++;

    if (left === i) {
      speeds[i] = 0;
      continue;
    }

    const dtS = (smoothed[i]!.fix.ts - smoothed[left]!.fix.ts) / 1000;
    speeds[i] = dtS > 0 ? haversineDistanceM(smoothed[left]!, smoothed[i]!) / dtS : 0;
  }

  return speeds;
}

/**
 * Turns filtered raw fixes into a cleaned, derived track: Kalman-smoothed
 * positions, a moving/stopped classification, and cumulative distance and
 * time. This is the shared step both live on-phone stats and server-side
 * reprocessing run before splits, best efforts, or elevation.
 *
 * Moving/stopped is classified from a windowed net-displacement speed (see
 * `CLASSIFICATION_WINDOW_MS`), and distance only accumulates while
 * `moving` is true, with a small fixed floor on top to absorb whatever
 * jitter remains in an individual step — this combination is what keeps a
 * stop at a traffic light from inflating distance or defeating auto-pause.
 */
export function cleanTrack(
  fixes: readonly RawFix[],
  autoPauseOpts: AutoPauseOptions,
  processNoiseMps = 3,
): CleanedPoint[] {
  if (fixes.length === 0) return [];

  const kalman = new GeoKalmanFilter(processNoiseMps);
  const smoothed: SmoothedFix[] = fixes.map((f) => ({
    ...applyKalman(kalman, f),
    fix: f,
  }));

  const classificationSpeeds = computeWindowedSpeeds(smoothed, CLASSIFICATION_WINDOW_MS);
  const moving = classifyMoving(
    smoothed.map((s, i) => ({ speedMps: classificationSpeeds[i]!, ts: s.fix.ts })),
    autoPauseOpts,
  );

  // The per-point "speed" shown to the user is instantaneous, smoothed
  // only by the Kalman filter itself, so a real pace change (e.g. a
  // sprint finish) shows up promptly rather than being averaged away by
  // the wider classification window above.
  const instantSpeeds = smoothed.map((s, i) => {
    if (i === 0) return 0;
    const prev = smoothed[i - 1]!;
    const dtS = (s.fix.ts - prev.fix.ts) / 1000;
    return dtS > 0 ? haversineDistanceM(prev, s) / dtS : 0;
  });

  const points: CleanedPoint[] = [];
  let cumulativeDistanceM = 0;
  let cumulativeMovingTimeS = 0;
  const startTs = fixes[0]!.ts;
  let lastSegment = fixes[0]!.segment;

  for (let i = 0; i < smoothed.length; i++) {
    const s = smoothed[i]!;
    const isMoving = moving[i]!;

    if (i > 0) {
      const prev = smoothed[i - 1]!;
      const dtS = (s.fix.ts - prev.fix.ts) / 1000;

      // A segment break (recovery after a tracking gap) never contributes
      // distance, since we don't know what happened in between.
      if (s.fix.segment === lastSegment && isMoving) {
        const distM = haversineDistanceM(prev, s);
        if (distM > STATIONARY_JITTER_RADIUS_M) {
          cumulativeDistanceM += distM;
        }
        cumulativeMovingTimeS += dtS;
      }
      if (s.fix.segment !== lastSegment) {
        lastSegment = s.fix.segment;
      }
    }

    points.push({
      ts: s.fix.ts,
      lat: s.lat,
      lng: s.lng,
      alt: s.fix.alt ?? null,
      speed: instantSpeeds[i] ?? null,
      hr: s.fix.hr ?? null,
      cadence: s.fix.cadence ?? null,
      segment: s.fix.segment,
      moving: isMoving,
      cumulativeDistanceM,
      cumulativeMovingTimeS,
      // Wall-clock seconds since the first point. Explicit user pauses are
      // expected to already be excluded from `fixes` by the caller (the
      // recorder only feeds fixes captured outside a manual Pause), so this
      // naturally reflects elapsed recording time, not calendar time.
      elapsedTimeS: (s.fix.ts - startTs) / 1000,
    });
  }

  return points;
}

function applyKalman(kalman: GeoKalmanFilter, fix: RawFix): { lat: number; lng: number } {
  const accuracyM = fix.hAcc ?? 10;
  return kalman.process(fix.lat, fix.lng, accuracyM, fix.ts);
}
