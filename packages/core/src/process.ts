import { defaultAutoPauseOptions, type AutoPauseOptions } from "./autopause.js";
import { computeBestEfforts } from "./bestEfforts.js";
import { estimateCalories } from "./calories.js";
import { cleanTrack } from "./clean.js";
import { computeElevation } from "./elevation.js";
import { defaultFilterOptions, filterFixes, type FilterOptions } from "./filter.js";
import { boundingBoxOf, evenlySpacedIndices, simplifyIndices } from "./geo.js";
import { encodePolyline } from "./polyline.js";
import { computePrivacyWindow } from "./privacy.js";
import { computeImperialSplits, computeMetricSplits } from "./splits.js";
import type {
  CleanedPoint,
  DownsampledStreams,
  PrivacyZone,
  ProcessedActivity,
  RawFix,
  SportType,
} from "./types.js";

/** A fix gap this long or longer during recording is flagged for the client and Sentry. */
const GAP_THRESHOLD_S = 30;

/** Cap on chart/map stream resolution, independent of activity duration. */
const DEFAULT_MAX_STREAM_POINTS = 2000;

/** Target point budget for the feed/summary polyline. */
const SUMMARY_POLYLINE_MAX_POINTS = 300;
const SUMMARY_POLYLINE_TOLERANCE_M = 4;

export interface ProcessActivityInput {
  /** Client-generated UUIDv7; also seeds the deterministic privacy-zone jitter. */
  activityId: string;
  sport: SportType;
  fixes: readonly RawFix[];
  privacyZones: readonly PrivacyZone[];
  weightKg: number | null;
  filterOptions?: FilterOptions;
  autoPauseOptions?: AutoPauseOptions;
  maxStreamPoints?: number;
}

/**
 * The single authoritative pipeline from a raw fix array to everything an
 * activity record needs: filtered/cleaned track, stats, splits, best
 * efforts, the privacy-trimmed summary polyline, and downsampled streams.
 * Runs identically on the phone (for a quick local preview after Finish)
 * and in the ingest Edge Function (as the authoritative result) because
 * both call this same function from `packages/core`.
 */
export function processActivity(input: ProcessActivityInput): ProcessedActivity {
  const filterOptions = input.filterOptions ?? defaultFilterOptions(input.sport);
  const autoPauseOptions = input.autoPauseOptions ?? defaultAutoPauseOptions(input.sport);
  const maxStreamPoints = input.maxStreamPoints ?? DEFAULT_MAX_STREAM_POINTS;

  const filtered = filterFixes(input.fixes, filterOptions);
  const cleaned = cleanTrack(filtered, autoPauseOptions);

  if (cleaned.length < 2) {
    return emptyResult();
  }

  const { gapCount, longestGapS } = detectGaps(cleaned);

  const altitudes = cleaned.map((p) => p.alt).filter((a): a is number => a != null);
  const elevation = computeElevation(altitudes);

  const last = cleaned[cleaned.length - 1]!;
  const elapsedTimeS = last.elapsedTimeS;
  const movingTimeS = last.cumulativeMovingTimeS;
  const distanceM = last.cumulativeDistanceM;
  const avgSpeedMps = movingTimeS > 0 ? distanceM / movingTimeS : 0;
  const maxSpeedMps = cleaned.reduce((max, p) => Math.max(max, p.speed ?? 0), 0);

  const splitsMetric = computeMetricSplits(cleaned);
  const splitsImperial = computeImperialSplits(cleaned);
  const bestEfforts = computeBestEfforts(cleaned);

  const privacy = computePrivacyWindow(cleaned, input.privacyZones, input.activityId);
  const visiblePoints: readonly CleanedPoint[] =
    privacy.visibleToIdx >= privacy.visibleFromIdx
      ? cleaned.slice(privacy.visibleFromIdx, privacy.visibleToIdx + 1)
      : [];

  const summaryPolyline = buildSummaryPolyline(visiblePoints);
  const boundingBox = boundingBoxOf(visiblePoints);
  const startLatLng = visiblePoints[0] ? { lat: visiblePoints[0].lat, lng: visiblePoints[0].lng } : null;
  const endLatLng = visiblePoints.length
    ? { lat: visiblePoints[visiblePoints.length - 1]!.lat, lng: visiblePoints[visiblePoints.length - 1]!.lng }
    : null;

  const streams = buildStreams(cleaned, maxStreamPoints);

  return {
    stats: {
      distanceM,
      elapsedTimeS,
      movingTimeS,
      elevationGainM: elevation.gainM,
      elevationLossM: elevation.lossM,
      elevHighM: elevation.highM,
      elevLowM: elevation.lowM,
      avgSpeedMps,
      maxSpeedMps,
      calories: estimateCalories(input.sport, movingTimeS, avgSpeedMps, input.weightKg),
    },
    splitsMetric,
    splitsImperial,
    bestEfforts,
    summaryPolyline,
    startLatLng,
    endLatLng,
    boundingBox,
    streams,
    visibleFromIdx: streams.pointCount > 0 ? remapIndex(cleaned.length, streams, privacy.visibleFromIdx, "from") : 0,
    visibleToIdx: streams.pointCount > 0 ? remapIndex(cleaned.length, streams, privacy.visibleToIdx, "to") : -1,
    gapCount,
    longestGapS,
  };
}

function detectGaps(points: readonly CleanedPoint[]): { gapCount: number; longestGapS: number } {
  let gapCount = 0;
  let longestGapS = 0;
  for (let i = 1; i < points.length; i++) {
    const dtS = (points[i]!.ts - points[i - 1]!.ts) / 1000;
    if (dtS > GAP_THRESHOLD_S) {
      gapCount++;
      if (dtS > longestGapS) longestGapS = dtS;
    }
  }
  return { gapCount, longestGapS };
}

function buildSummaryPolyline(visiblePoints: readonly CleanedPoint[]): string {
  if (visiblePoints.length === 0) return "";
  const latLngs = visiblePoints.map((p) => ({ lat: p.lat, lng: p.lng }));
  let indices = simplifyIndices(latLngs, SUMMARY_POLYLINE_TOLERANCE_M);
  if (indices.length > SUMMARY_POLYLINE_MAX_POINTS) {
    const picked = evenlySpacedIndices(indices.length, SUMMARY_POLYLINE_MAX_POINTS);
    indices = picked.map((i) => indices[i]!);
  }
  return encodePolyline(indices.map((i) => latLngs[i]!));
}

function buildStreams(
  cleaned: readonly CleanedPoint[],
  maxStreamPoints: number,
): DownsampledStreams & { __dsIndices?: number[] } {
  const dsIndices = evenlySpacedIndices(cleaned.length, Math.min(maxStreamPoints, cleaned.length));

  const streams: DownsampledStreams = {
    pointCount: dsIndices.length,
    timeS: dsIndices.map((i) => Math.round(cleaned[i]!.elapsedTimeS)),
    latE7: dsIndices.map((i) => Math.round(cleaned[i]!.lat * 1e7)),
    lngE7: dsIndices.map((i) => Math.round(cleaned[i]!.lng * 1e7)),
    altitudeM: dsIndices.map((i) => cleaned[i]!.alt ?? 0),
    distanceM: dsIndices.map((i) => cleaned[i]!.cumulativeDistanceM),
    speedMps: dsIndices.map((i) => cleaned[i]!.speed ?? 0),
    heartrate: dsIndices.map((i) => cleaned[i]!.hr),
    cadence: dsIndices.map((i) => cleaned[i]!.cadence),
    moving: dsIndices.map((i) => cleaned[i]!.moving),
  };

  return Object.assign(streams, { __dsIndices: dsIndices });
}

/** Maps a visibility boundary from the full cleaned-point index space into the downsampled stream index space. */
function remapIndex(
  _cleanedLength: number,
  streamsWithIndices: DownsampledStreams & { __dsIndices?: number[] },
  fullIdx: number,
  edge: "from" | "to",
): number {
  const dsIndices = streamsWithIndices.__dsIndices ?? [];
  if (dsIndices.length === 0) return edge === "from" ? 0 : -1;

  if (edge === "from") {
    const found = dsIndices.findIndex((i) => i >= fullIdx);
    return found === -1 ? dsIndices.length - 1 : found;
  }

  for (let k = dsIndices.length - 1; k >= 0; k--) {
    if (dsIndices[k]! <= fullIdx) return k;
  }
  return -1;
}

function emptyResult(): ProcessedActivity {
  return {
    stats: {
      distanceM: 0,
      elapsedTimeS: 0,
      movingTimeS: 0,
      elevationGainM: 0,
      elevationLossM: 0,
      elevHighM: 0,
      elevLowM: 0,
      avgSpeedMps: 0,
      maxSpeedMps: 0,
      calories: null,
    },
    splitsMetric: [],
    splitsImperial: [],
    bestEfforts: [],
    summaryPolyline: "",
    startLatLng: null,
    endLatLng: null,
    boundingBox: null,
    streams: {
      pointCount: 0,
      timeS: [],
      latE7: [],
      lngE7: [],
      altitudeM: [],
      distanceM: [],
      speedMps: [],
      heartrate: [],
      cadence: [],
      moving: [],
    },
    visibleFromIdx: 0,
    visibleToIdx: -1,
    gapCount: 0,
    longestGapS: 0,
  };
}
