export type SportType = "run" | "ride" | "walk" | "hike";

export const SPORT_TYPES: readonly SportType[] = ["run", "ride", "walk", "hike"];

/** A single raw GPS fix as recorded on-device, before any cleaning. */
export interface RawFix {
  /** Epoch milliseconds. */
  ts: number;
  lat: number;
  lng: number;
  /** Meters above sea level, GPS-reported. */
  alt?: number | null;
  /** Horizontal accuracy radius in meters (68% confidence, per platform convention). */
  hAcc?: number | null;
  vAcc?: number | null;
  /** Device-reported speed in meters/second. */
  speed?: number | null;
  /** Course/heading in degrees, 0-360. */
  course?: number | null;
  hr?: number | null;
  cadence?: number | null;
  /**
   * Segment index. Incremented whenever recording resumes after a tracking
   * gap (e.g. the OS killed the recorder), so distance is never summed
   * across the gap as a straight line.
   */
  segment: number;
}

/** A fix after filtering and Kalman smoothing, with derived running totals. */
export interface CleanedPoint {
  ts: number;
  lat: number;
  lng: number;
  alt: number | null;
  speed: number | null;
  hr: number | null;
  cadence: number | null;
  segment: number;
  /** True if this point counts as "moving" for moving-time and distance purposes. */
  moving: boolean;
  /** Cumulative distance in meters from the start of the activity, moving segments only. */
  cumulativeDistanceM: number;
  /** Cumulative moving time in seconds from the start of the activity. */
  cumulativeMovingTimeS: number;
  /** Elapsed wall-clock seconds from the first kept fix, excluding explicit pauses. */
  elapsedTimeS: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export type EffortKey =
  | "400m"
  | "1k"
  | "1mi"
  | "5k"
  | "10k"
  | "half"
  | "marathon";

export const EFFORT_DISTANCES_M: Record<EffortKey, number> = {
  "400m": 400,
  "1k": 1000,
  "1mi": 1609.344,
  "5k": 5000,
  "10k": 10000,
  half: 21097.5,
  marathon: 42195,
};

export interface BestEffort {
  effortKey: EffortKey;
  elapsedTimeS: number;
  startIdx: number;
  endIdx: number;
}

export interface Split {
  index: number;
  distanceM: number;
  movingTimeS: number;
  elapsedTimeS: number;
  elevationGainM: number;
  avgSpeedMps: number;
}

export interface PrivacyZone {
  center: LatLng;
  radiusM: number;
}

export interface ActivityStats {
  distanceM: number;
  elapsedTimeS: number;
  movingTimeS: number;
  elevationGainM: number;
  elevationLossM: number;
  elevHighM: number;
  elevLowM: number;
  avgSpeedMps: number;
  maxSpeedMps: number;
  calories: number | null;
}

export interface DownsampledStreams {
  pointCount: number;
  timeS: number[];
  latE7: number[];
  lngE7: number[];
  altitudeM: number[];
  distanceM: number[];
  speedMps: number[];
  heartrate: (number | null)[];
  cadence: (number | null)[];
  moving: boolean[];
}

export interface ProcessedActivity {
  stats: ActivityStats;
  splitsMetric: Split[];
  splitsImperial: Split[];
  bestEfforts: BestEffort[];
  summaryPolyline: string;
  startLatLng: LatLng | null;
  endLatLng: LatLng | null;
  boundingBox: BoundingBox | null;
  streams: DownsampledStreams;
  visibleFromIdx: number;
  visibleToIdx: number;
  gapCount: number;
  longestGapS: number;
}
