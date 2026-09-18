import type { MeasurementSystem } from "@stride/contracts";

const METERS_PER_MILE = 1609.344;

export function formatDistance(distanceM: number, system: MeasurementSystem): string {
  if (system === "imperial") {
    return `${(distanceM / METERS_PER_MILE).toFixed(2)} mi`;
  }
  return `${(distanceM / 1000).toFixed(2)} km`;
}

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Pace as min:sec per km or per mile, from a speed in meters/second. */
export function formatPace(speedMps: number, system: MeasurementSystem): string {
  if (speedMps <= 0) return "--:--";
  const unitDistanceM = system === "imperial" ? METERS_PER_MILE : 1000;
  const secondsPerUnit = unitDistanceM / speedMps;
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  const unit = system === "imperial" ? "/mi" : "/km";
  return `${m}:${String(s).padStart(2, "0")}${unit}`;
}

export function formatElevation(meters: number | null, system: MeasurementSystem): string {
  if (meters == null) return "--";
  if (system === "imperial") {
    return `${Math.round(meters * 3.28084)} ft`;
  }
  return `${Math.round(meters)} m`;
}
